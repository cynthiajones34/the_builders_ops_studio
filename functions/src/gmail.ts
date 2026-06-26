import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { db, CORS_ORIGINS, HttpError, requireUser } from "./shared";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const GOOGLE_OAUTH_CLIENT_ID = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");

const REGION = "us-central1";

// Google sends the user back here after consent. Routed through Firebase
// Hosting (web.app) so the function never needs public invoke. Must be
// registered EXACTLY as an Authorized redirect URI on the OAuth client.
const REDIRECT_URI = "https://the-builders-ops-studio.web.app/api/gmailOauthCallback";

// Where the user lands in the portal after the callback finishes.
const PORTAL_RETURN_URL = "https://www.thebuildersopsstudio.com/admin/#/email";

// Read-only access only. Gmail for Email Intelligence; Drive for reading the
// Gemini meeting-notes docs (Meeting Intelligence). Nothing is ever written.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

// The fixed taxonomy the inbox gets sorted into. Mirrors the prototype.
const CATEGORIES = [
  "Potential Client",
  "Speaking",
  "Partnership",
  "Media",
  "Networking",
  "Invoice",
  "Admin",
] as const;

function oauthClient() {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID.value(),
    GOOGLE_OAUTH_CLIENT_SECRET.value(),
    REDIRECT_URI
  );
}

/**
 * Step 1. The portal calls this (authenticated). It mints a short-lived state
 * token tied to the user and returns the Google consent URL to redirect to.
 */
export const gmailAuthUrl = onRequest(
  {
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
    region: REGION,
    cors: CORS_ORIGINS,
  },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const state = randomBytes(24).toString("hex");
      await db.collection("oauthStates").doc(state).set({ uid, createdAt: Date.now() });

      const url = oauthClient().generateAuthUrl({
        access_type: "offline",
        prompt: "consent", // force a refresh_token even on re-auth
        scope: SCOPES,
        state,
      });

      res.json({ url });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("gmailAuthUrl failed", err?.message);
      res.status(status).json({
        error: status >= 500 ? "Couldn't start the Gmail connection." : err.message,
      });
    }
  }
);

/**
 * Step 2. Google redirects the browser here after consent. This is a plain
 * HTTPS endpoint (no auth context), so identity comes from the state token. It
 * exchanges the code for a refresh token, stores it server-side, and bounces
 * the user back into the portal. Reached via the Hosting rewrite.
 */
export const gmailOauthCallback = onRequest(
  {
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
    region: REGION,
  },
  async (req, res) => {
    const fail = (reason: string) => {
      console.error("gmailOauthCallback:", reason);
      res.redirect(`${PORTAL_RETURN_URL}?gmail=error`);
    };

    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) return fail("missing code or state");

      const stateRef = db.collection("oauthStates").doc(state);
      const stateSnap = await stateRef.get();
      if (!stateSnap.exists) return fail("unknown state");
      const { uid, createdAt } = stateSnap.data() as { uid: string; createdAt: number };
      await stateRef.delete();
      if (Date.now() - createdAt > 10 * 60 * 1000) return fail("state expired");

      const client = oauthClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.refresh_token) {
        return fail("no refresh_token returned (user may have already granted access)");
      }

      // Whose mailbox did they connect? Read it for display.
      client.setCredentials(tokens);
      const profile = await google
        .gmail({ version: "v1", auth: client })
        .users.getProfile({ userId: "me" });
      const connectedEmail = profile.data.emailAddress ?? null;

      // Which scopes did they actually grant? The UI uses this to know whether
      // Drive (meetings) is available, not just Gmail.
      const grantedScopes = tokens.scope ?? "";

      // Refresh token: server-only path, never exposed to the client.
      await db.doc(`users/${uid}/private/gmail`).set({
        refreshToken: tokens.refresh_token,
        connectedEmail,
        scopes: grantedScopes,
        connectedAt: Date.now(),
      });
      await db.doc(`users/${uid}/meta/gmail`).set(
        { connected: true, connectedEmail, scopes: grantedScopes, connectedAt: Date.now() },
        { merge: true }
      );

      res.redirect(`${PORTAL_RETURN_URL}?gmail=connected`);
    } catch (err: any) {
      fail(err?.message ?? "callback failed");
    }
  }
);

type RawEmail = { id: string; from: string; subject: string; snippet: string; date: string };

function header(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Step 3. Pull recent inbox messages, have Claude sort them into the BOS
 * taxonomy with a priority flag and a one-line "why it matters", and write the
 * results to Firestore for the Email Intelligence module to render.
 */
export const syncGmail = onRequest(
  {
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, ANTHROPIC_API_KEY],
    region: REGION,
    cors: CORS_ORIGINS,
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const tokenSnap = await db.doc(`users/${uid}/private/gmail`).get();
      const refreshToken = tokenSnap.exists ? (tokenSnap.data() as any).refreshToken : null;
      if (!refreshToken) throw new HttpError(412, "Gmail isn't connected yet.");

      const client = oauthClient();
      client.setCredentials({ refresh_token: refreshToken });
      const gmail = google.gmail({ version: "v1", auth: client });

      // Recent inbox only. Read-only, capped so a sync stays fast and cheap.
      const list = await gmail.users.messages.list({
        userId: "me",
        q: "in:inbox newer_than:14d",
        maxResults: 30,
      });
      const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

      const raw: RawEmail[] = [];
      for (const id of ids) {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = msg.data.payload?.headers ?? undefined;
        raw.push({
          id,
          from: header(headers, "From"),
          subject: header(headers, "Subject"),
          snippet: (msg.data.snippet ?? "").slice(0, 300),
          date: header(headers, "Date"),
        });
      }

      const categorized = raw.length ? await categorize(raw) : [];

      // Replace the stored inbox with this fresh sync.
      const col = db.collection(`users/${uid}/emails`);
      const existing = await col.get();
      const batch = db.batch();
      existing.forEach((d) => batch.delete(d.ref));
      for (const e of categorized) batch.set(col.doc(e.id), e);
      batch.set(
        db.doc(`users/${uid}/meta/gmail`),
        { connected: true, lastSync: Date.now(), count: categorized.length },
        { merge: true }
      );
      await batch.commit();

      res.json({ count: categorized.length });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("syncGmail failed", err?.message);
      res.status(status).json({
        error: status >= 500 ? "The sync couldn't finish. Try again." : err.message,
      });
    }
  }
);

type Categorized = RawEmail & { category: string; priority: boolean; why: string };

async function categorize(raw: RawEmail[]): Promise<Categorized[]> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

  const system = `You sort an Atlanta operations consultant's inbox for The Builders' Ops Studio. She helps Black women entrepreneurs get into operational control.

Sort each email into exactly one category from this list:
${CATEGORIES.join(", ")}.

Rules:
- "Potential Client": someone who could hire her or is mid-deal.
- "Speaking": event, panel, podcast, or workshop invitations.
- "Partnership": collaborations, affiliate, or cross-promotion offers.
- "Media": press, features, interviews, publications.
- "Networking": intros, coffee, community, relationship-building.
- "Invoice": billing, payments, receipts, money owed.
- "Admin": newsletters, notifications, calendar, everything else.
- priority = true only if it needs her personal attention soon (a real person waiting on a real decision or a deadline). Bulk and automated mail is never priority.
- "why": one short sentence, no em dashes, on what it means for the business. Never start with "I".

Return ONLY a JSON array, one object per input id, shape:
[{"id":"<id>","category":"<one of the list>","priority":true|false,"why":"<one sentence>"}]`;

  const payload = raw.map((r) => ({
    id: r.id,
    from: r.from,
    subject: r.subject,
    snippet: r.snippet,
  }));

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let parsed: { id: string; category: string; priority: boolean; why: string }[] = [];
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    parsed = [];
  }
  const byId = new Map(parsed.map((p) => [p.id, p]));

  return raw.map((r) => {
    const c = byId.get(r.id);
    const category =
      c && (CATEGORIES as readonly string[]).includes(c.category) ? c.category : "Admin";
    return {
      ...r,
      category,
      priority: Boolean(c?.priority),
      why: typeof c?.why === "string" ? c.why : "",
    };
  });
}

/**
 * Meeting Intelligence. Reads the user's Gemini meeting-notes / transcript docs
 * from Google Drive (read-only), and has Claude turn each into a summary plus
 * action items, decisions, and opportunities, stored for the Meetings module.
 */
export const syncMeetings = onRequest(
  {
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, ANTHROPIC_API_KEY],
    region: REGION,
    cors: CORS_ORIGINS,
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const tokenSnap = await db.doc(`users/${uid}/private/gmail`).get();
      const refreshToken = tokenSnap.exists ? (tokenSnap.data() as any).refreshToken : null;
      if (!refreshToken) throw new HttpError(412, "Connect your Google account first.");

      const client = oauthClient();
      client.setCredentials({ refresh_token: refreshToken });
      const drive = google.drive({ version: "v3", auth: client });

      const since = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
      let files;
      try {
        const list = await drive.files.list({
          q:
            `mimeType='application/vnd.google-apps.document' and trashed=false ` +
            `and modifiedTime > '${since}' ` +
            `and (name contains 'Notes by Gemini' or name contains 'Transcript')`,
          orderBy: "modifiedTime desc",
          pageSize: 20,
          fields: "files(id,name,modifiedTime,webViewLink)",
        });
        files = list.data.files ?? [];
      } catch {
        // Most likely the Drive scope hasn't been granted on this connection yet.
        throw new HttpError(
          412,
          "Reconnect your Google account to grant Drive access for meetings."
        );
      }

      const meetings: any[] = [];
      for (const f of files) {
        let text = "";
        try {
          const exp = await drive.files.export(
            { fileId: f.id!, mimeType: "text/plain" },
            { responseType: "text" }
          );
          text = typeof exp.data === "string" ? exp.data : String(exp.data ?? "");
        } catch {
          continue;
        }
        if (!text.trim()) continue;

        const extracted = await extractMeeting(f.name ?? "Meeting", text.slice(0, 24000));
        meetings.push({
          id: f.id!,
          title: extracted.title || f.name || "Meeting",
          date: f.modifiedTime ?? "",
          summary: extracted.summary,
          actions: extracted.actions,
          decisions: extracted.decisions,
          opportunities: extracted.opportunities,
          docUrl: f.webViewLink ?? "",
        });
      }

      const col = db.collection(`users/${uid}/meetings`);
      const existing = await col.get();
      const batch = db.batch();
      existing.forEach((d) => batch.delete(d.ref));
      for (const m of meetings) batch.set(col.doc(m.id), m);
      batch.set(
        db.doc(`users/${uid}/meta/meetings`),
        { lastSync: Date.now(), count: meetings.length },
        { merge: true }
      );
      await batch.commit();

      res.json({ count: meetings.length });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("syncMeetings failed", err?.message);
      res.status(status).json({
        error: status >= 500 ? "The meeting sync couldn't finish. Try again." : err.message,
      });
    }
  }
);

type MeetingExtract = {
  title: string;
  summary: string;
  actions: string[];
  decisions: string[];
  opportunities: string[];
};

async function extractMeeting(name: string, text: string): Promise<MeetingExtract> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

  const system = `You read a meeting transcript or notes for Cynthia Jones, an Atlanta operations consultant (The Builders' Ops Studio). Turn it into a tight readout she can act on.

Rules: no em dashes; short sentences; never start a line with "I"; be specific and reference real names and commitments from the notes; don't invent anything not in the text.

Return ONLY JSON with this exact shape:
{"title":"<short human meeting title>","summary":"<2 to 3 sentence summary>","actions":["..."],"decisions":["..."],"opportunities":["..."]}
- actions: concrete next steps, with the owner in parentheses if the notes name one.
- decisions: things that were decided. Empty array if none.
- opportunities: revenue, speaking, partnership, or content openings worth pursuing. Empty array if none.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: `Meeting doc "${name}":\n\n${text}` }],
  });
  const out = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const clean = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  try {
    const p = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    return {
      title: typeof p.title === "string" ? p.title : name,
      summary: typeof p.summary === "string" ? p.summary : "",
      actions: clean(p.actions),
      decisions: clean(p.decisions),
      opportunities: clean(p.opportunities),
    };
  } catch {
    return { title: name, summary: "", actions: [], decisions: [], opportunities: [] };
  }
}
