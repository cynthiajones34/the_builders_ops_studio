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

// Read-only access to the inbox. Nothing is ever sent or deleted.
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

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
    invoker: "private",
  },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const state = randomBytes(24).toString("hex");
      await db.collection("oauthStates").doc(state).set({ uid, createdAt: Date.now() });

      const url = oauthClient().generateAuthUrl({
        access_type: "offline",
        prompt: "consent", // force a refresh_token even on re-auth
        scope: [GMAIL_SCOPE],
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
    invoker: "private",
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

      // Refresh token: server-only path, never exposed to the client.
      await db.doc(`users/${uid}/private/gmail`).set({
        refreshToken: tokens.refresh_token,
        connectedEmail,
        connectedAt: Date.now(),
      });
      await db.doc(`users/${uid}/meta/gmail`).set(
        { connected: true, connectedEmail, connectedAt: Date.now() },
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
    invoker: "private",
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
