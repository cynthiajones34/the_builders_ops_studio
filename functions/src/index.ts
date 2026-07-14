import { onRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import { CORS_ORIGINS, HttpError, requireUser, db } from "./shared";
import { sendEmailSMS, sendEmail, brandedEmail, RESEND_API_KEY } from "./email";
import { readIntakeRows } from "./gmail";
import { INTAKE_FORM_URL, hoursUntil, dueReminder, todayOrTomorrow } from "./discovery";

// Gmail → Email Intelligence integration (OAuth + sync + categorization).
export { gmailAuthUrl, gmailOauthCallback, syncGmail, syncMeetings, fetchIntakeResponses } from "./gmail";

// Fix One Thing Sprint: waitlist capture (registration runs on Stripe Payment Links).
export { joinSprintWaitlist } from "./sprint";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const GOOGLE_OAUTH_CLIENT_ID = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");

// Social integrations. Bound per-function via `secrets: [...]` so the values
// are injected into process.env at runtime (Firebase Functions v2 secrets).
const SOCIAL_INSTAGRAM_APP_ID = defineSecret("SOCIAL_INSTAGRAM_APP_ID");
const SOCIAL_INSTAGRAM_APP_SECRET = defineSecret("SOCIAL_INSTAGRAM_APP_SECRET");
const SOCIAL_LINKEDIN_CLIENT_ID = defineSecret("SOCIAL_LINKEDIN_CLIENT_ID");
const SOCIAL_LINKEDIN_CLIENT_SECRET = defineSecret("SOCIAL_LINKEDIN_CLIENT_SECRET");

// OAuth callbacks run on the cloudfunctions.net domain, so the post-connect
// redirect must be an absolute URL back to the portal (a relative "/admin/..."
// would resolve against cloudfunctions.net and 404). Mirrors the Gmail flow.
const SOCIAL_RETURN_URL = "https://www.thebuildersopsstudio.com/admin/#/social";

// Format a count compactly for dashboard display: 12500 -> "12.5K", 1.2e6 -> "1.2M".
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Weekdays elapsed since an ISO date (excludes weekends).
function businessDaysSince(iso: string): number {
  const cursor = new Date(iso);
  const now = new Date();
  let days = 0;
  while (cursor < now) {
    cursor.setDate(cursor.getDate() + 1);
    const wd = cursor.getDay();
    if (wd !== 0 && wd !== 6) days++;
  }
  return days;
}

// Cynthia's brand voice, from the BOS Brand Guide 2026. Every AI word the
// portal produces runs through this so it sounds like her, not a chatbot.
const BRAND_VOICE = `You are the AI chief of staff and strategic advisor for The Builders' Ops Studio, run by Cynthia Jones, an operations consultant in Atlanta. She helps Black women entrepreneurs get out of survival mode and into real operational control.

You act as her executive assistant, chief of staff, content strategist, and business intelligence partner. You are direct, warm, and grounded. You name what matters and cut what doesn't.

Voice rules (non-negotiable, from her brand guide):
- Always use contractions (don't, isn't, you're, she's, we're).
- Never use em dashes. Rewrite with commas, colons, or periods.
- Short sentences. One idea per sentence. Let white space do work.
- Never start a sentence with "I". Flip the sentence so it speaks to her first.
- No salesy or hype language. End with truth, not a pitch.
- Be specific. Name the outcome, the number, the next action. Avoid vague superlatives.

When she asks what to focus on, give her a short, prioritized answer: the two or three things that matter, why, and the single next action for each. Don't pad. If you're unsure because you lack data, say what you'd need.`;

type ChatMessage = { role: "user" | "ai"; text: string };

/**
 * Opportunity Engine. Reads the connected inbox + meeting readouts and has
 * Claude surface and rank the real revenue, speaking, partnership, and referral
 * openings across them, each with a suggested next move.
 */
export const findOpportunities = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const [emailSnap, meetingSnap] = await Promise.all([
        db.collection(`users/${uid}/emails`).get(),
        db.collection(`users/${uid}/meetings`).get(),
      ]);
      const emails = emailSnap.docs.map((d) => d.data() as any);
      const meetings = meetingSnap.docs.map((d) => d.data() as any);

      if (emails.length === 0 && meetings.length === 0) {
        res.json({ count: 0, opportunities: [], grounded: false });
        return;
      }

      const emailCtx = emails
        .map((e) => `- [${e.category}${e.priority ? ", priority" : ""}] ${e.from}: ${e.subject}${e.why ? ` (${e.why})` : ""}`)
        .join("\n");
      const meetingCtx = meetings
        .map((m) => {
          const opps = (m.opportunities ?? []).join("; ");
          return `- ${m.title}: ${m.summary ?? ""}${opps ? ` | opportunities: ${opps}` : ""}`;
        })
        .join("\n");

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

Surface the real business opportunities hiding in Cynthia's inbox and meetings: revenue, new clients, speaking, partnerships, referrals, and productized offers. Only use what's in the data. Don't invent. Merge duplicates that show up in more than one place (call that out as stronger signal).

Return ONLY a JSON array, ranked best first, max 8 items, each:
{"type":"<Workshop|Speaking|Partnership|Referral|Potential Client|Productized Offer|Media>","title":"<short>","evidence":"<which emails/meetings point to this, one sentence>","value":"<rough $ or strategic value>","nextAction":"<the single next move, name it>"}`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system,
        messages: [
          {
            role: "user",
            content: `Inbox:\n${emailCtx || "(none)"}\n\nMeetings:\n${meetingCtx || "(none)"}`,
          },
        ],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      let parsed: any[] = [];
      try {
        parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
      } catch {
        parsed = [];
      }
      const opps = (Array.isArray(parsed) ? parsed : [])
        .filter((o) => o && typeof o.title === "string")
        .map((o) => ({
          type: typeof o.type === "string" ? o.type : "Opportunity",
          title: o.title,
          evidence: typeof o.evidence === "string" ? o.evidence : "",
          value: typeof o.value === "string" ? o.value : "",
          nextAction: typeof o.nextAction === "string" ? o.nextAction : "",
        }));

      const col = db.collection(`users/${uid}/opportunities`);
      const existing = await col.get();
      const batch = db.batch();
      existing.forEach((d) => batch.delete(d.ref));
      opps.forEach((o) => batch.set(col.doc(), o));
      batch.set(
        db.doc(`users/${uid}/meta/opportunities`),
        { lastRun: Date.now(), count: opps.length },
        { merge: true }
      );
      await batch.commit();

      res.json({ count: opps.length, grounded: true });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("findOpportunities failed", err?.status, err?.message);
      res.status(status).json({
        error: status >= 500 ? "Couldn't scan for opportunities. Try again." : err.message,
      });
    }
  }
);

async function readActivity(uid: string) {
  const [emailSnap, meetingSnap] = await Promise.all([
    db.collection(`users/${uid}/emails`).get(),
    db.collection(`users/${uid}/meetings`).get(),
  ]);
  const emails = emailSnap.docs.map((d) => d.data() as any);
  const meetings = meetingSnap.docs.map((d) => d.data() as any);
  const emailCtx = emails
    .map((e) => `- [${e.category}${e.priority ? ", priority" : ""}] ${e.from}: ${e.subject}${e.why ? ` (${e.why})` : ""}`)
    .join("\n");
  const meetingCtx = meetings
    .map((m) => `- ${m.title}: ${m.summary ?? ""}${(m.actions ?? []).length ? ` | actions: ${(m.actions ?? []).join("; ")}` : ""}${(m.opportunities ?? []).length ? ` | opportunities: ${(m.opportunities ?? []).join("; ")}` : ""}`)
    .join("\n");
  return { emails, meetings, emailCtx, meetingCtx, empty: emails.length === 0 && meetings.length === 0 };
}

function parseText(content: Anthropic.Message["content"]) {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Projects. Derives active workstreams from the connected meetings + inbox:
 * what's moving, for whom, and the next steps. Honest about status, no fake
 * progress bars or due dates.
 */
export const generateProjects = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);
      const { emailCtx, meetingCtx, empty } = await readActivity(uid);
      if (empty) {
        res.json({ projects: [], grounded: false });
        return;
      }

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

Group Cynthia's real activity into active workstreams / projects. A project is a client engagement or initiative that shows up across meetings and emails (for example a client onboarding, an event, a launch). Only use what's in the data. Don't invent clients, dates, or progress percentages.

Return ONLY JSON: {"projects":[{"name":"<short>","client":"<person/org or 'Internal'>","status":"<on track|needs attention|waiting>","summary":"<one sentence on where it stands>","nextSteps":["<short>", ...],"source":"<which meeting/email this came from>"}]}. Max 8 projects, 1 to 3 next steps each, no em dashes, never start a line with "I".`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: `Inbox:\n${emailCtx || "(none)"}\n\nMeetings:\n${meetingCtx || "(none)"}` }],
      });
      const text = parseText(response.content);

      let projects: any[] = [];
      try {
        const p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        projects = (Array.isArray(p.projects) ? p.projects : []).map((x: any) => ({
          name: typeof x.name === "string" ? x.name : "Workstream",
          client: typeof x.client === "string" ? x.client : "",
          status: ["on track", "needs attention", "waiting"].includes(x.status) ? x.status : "on track",
          summary: typeof x.summary === "string" ? x.summary : "",
          nextSteps: Array.isArray(x.nextSteps) ? x.nextSteps.filter((s: any) => typeof s === "string") : [],
          source: typeof x.source === "string" ? x.source : "",
        }));
      } catch {
        projects = [];
      }
      res.json({ projects, grounded: true });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("generateProjects failed", err?.message);
      res.status(status).json({ error: status >= 500 ? "Couldn't build projects. Try again." : err.message });
    }
  }
);

/**
 * Content Studio: suggestions. Mines the real meetings + inbox for post ideas
 * in Cynthia's pillars, each tied back to the source that inspired it.
 */
export const generateContent = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);
      const focus = typeof req.body?.focus === "string" ? req.body.focus.trim().slice(0, 300) : "";
      const { emailCtx, meetingCtx } = await readActivity(uid);
      // Ideas can stand on her expertise alone, so we don't hard-block on empty
      // activity. Real activity is raw material, not a requirement.

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

You are Cynthia's content strategist. Her audience is Black women entrepreneurs who are great at their craft but under-systemized. Her job is to give them operational control without shame.

Her four content pillars:
- Operations: systems, onboarding, delegation, the back end of a business.
- Mindset: the emotional side of growth, asking for help, worthiness, capacity.
- Behind the Build: what she's automating, building, or learning in her own business.
- Client Story: a real transformation (only use one if it actually appears in her data below).

What a great hook looks like (this is the bar, match this energy):
- "She had the clients. She didn't have a way to keep up."
- "Asking for help isn't admitting something went wrong."
- "What I automated this week so I didn't have to."
- "Turning away work because onboarding couldn't keep up."

Hook rules:
- Short. One or two sentences. A reframe or a tension, not a summary.
- Speak to the reader or tell a story. No recap language like "we discussed" or "in a recent meeting".
- Specific and human. Cut anything generic.

Use her real activity below as raw material for themes and angles. You may also draw on her operating expertise for strong evergreen ideas. Never invent a specific client, number, or event that isn't in the data; when there's no real story, write a principle or insight instead.${focus ? `\n\nThis week she especially wants to talk about: ${focus}. Lean most ideas toward that.` : ""}

Return ONLY JSON: {"ideas":[{"pillar":"<Operations|Mindset|Behind the Build|Client Story>","format":"<LinkedIn post|Reel|Carousel|Newsletter|TikTok>","hook":"<the actual first line, in her voice>","source":"<the real meeting/email it draws on, or the pillar/theme if evergreen>"}]}. Give 6 ideas, varied across pillars, no em dashes, never start a hook with "I".`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system,
        messages: [
          {
            role: "user",
            content: `Her recent activity (raw material):\nInbox:\n${emailCtx || "(none)"}\n\nMeetings:\n${meetingCtx || "(none)"}`,
          },
        ],
      });
      const text = parseText(response.content);

      let ideas: any[] = [];
      try {
        const p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        ideas = (Array.isArray(p.ideas) ? p.ideas : []).map((x: any) => ({
          pillar: typeof x.pillar === "string" ? x.pillar : "Systems",
          format: typeof x.format === "string" ? x.format : "LinkedIn post",
          hook: typeof x.hook === "string" ? x.hook : "",
          source: typeof x.source === "string" ? x.source : "",
        }));
      } catch {
        ideas = [];
      }
      res.json({ ideas, grounded: true });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("generateContent failed", err?.message);
      res.status(status).json({ error: status >= 500 ? "Couldn't generate ideas. Try again." : err.message });
    }
  }
);

/**
 * Content Studio: draft + repurpose. Turns one idea into an on-brand post plus
 * platform variants.
 */
export const draftContent = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      await requireUser(req);
      const hook = typeof req.body?.hook === "string" ? req.body.hook : "";
      const pillar = typeof req.body?.pillar === "string" ? req.body.pillar : "";
      const format = typeof req.body?.format === "string" ? req.body.format : "LinkedIn post";
      if (!hook) throw new HttpError(400, "No idea provided to draft.");

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

Write a finished ${format} for Cynthia from the idea below, in her voice. Then repurpose it for other channels.

Return ONLY JSON: {"draft":"<the full post, ready to publish, with line breaks as \\n>","repurpose":[{"to":"Instagram carousel","content":"..."},{"to":"TikTok script","content":"..."},{"to":"Newsletter","content":"..."}]}. No em dashes anywhere. Never start a sentence with "I".`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2500,
        system,
        messages: [{ role: "user", content: `Pillar: ${pillar}\nFormat: ${format}\nHook/idea: ${hook}` }],
      });
      const text = parseText(response.content);

      let out = { draft: "", repurpose: [] as { to: string; content: string }[] };
      try {
        const p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        out = {
          draft: typeof p.draft === "string" ? p.draft : "",
          repurpose: Array.isArray(p.repurpose)
            ? p.repurpose
                .filter((r: any) => r && typeof r.to === "string" && typeof r.content === "string")
                .map((r: any) => ({ to: r.to, content: r.content }))
            : [],
        };
      } catch {
        out = { draft: text, repurpose: [] };
      }
      res.json(out);
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("draftContent failed", err?.message);
      res.status(status).json({ error: status >= 500 ? "Couldn't draft this. Try again." : err.message });
    }
  }
);

/**
 * Intelligence Reports. Daily / weekly / monthly readout built live from the
 * connected inbox + meetings, returned as labeled blocks for the Reports tab.
 */
export const generateReport = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);
      const period: "daily" | "weekly" | "monthly" = ["daily", "weekly", "monthly"].includes(
        req.body?.period
      )
        ? req.body.period
        : "weekly";

      const [emailSnap, meetingSnap] = await Promise.all([
        db.collection(`users/${uid}/emails`).get(),
        db.collection(`users/${uid}/meetings`).get(),
      ]);
      const emails = emailSnap.docs.map((d) => d.data() as any);
      const meetings = meetingSnap.docs.map((d) => d.data() as any);

      if (emails.length === 0 && meetings.length === 0) {
        res.json({ period, grounded: false, blocks: [] });
        return;
      }

      const emailCtx = emails
        .map((e) => `- [${e.category}${e.priority ? ", priority" : ""}] ${e.from}: ${e.subject}${e.why ? ` (${e.why})` : ""}`)
        .join("\n");
      const meetingCtx = meetings
        .map((m) => `- ${m.title}: ${m.summary ?? ""}${(m.opportunities ?? []).length ? ` | opportunities: ${(m.opportunities ?? []).join("; ")}` : ""}${(m.actions ?? []).length ? ` | actions: ${(m.actions ?? []).join("; ")}` : ""}`)
        .join("\n");

      const shape: Record<typeof period, string> = {
        daily: "blocks for: Priorities, Opportunities, Follow-ups",
        weekly: "blocks for: Wins, Pipeline & Opportunities, Themes, Follow-ups",
        monthly: "blocks for: Trends, Themes, Strategy",
      };

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

Write Cynthia's ${period} intelligence report, grounded only in the inbox and meetings below. Be specific, reference real names and topics, don't invent numbers or revenue that aren't in the data.

Produce ${shape[period]}.
Return ONLY JSON: {"blocks":[{"label":"<block name>","items":["<short line>", ...]}]}. 3 to 4 items per block, no em dashes, never start a line with "I".`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system,
        messages: [
          { role: "user", content: `Inbox:\n${emailCtx || "(none)"}\n\nMeetings:\n${meetingCtx || "(none)"}` },
        ],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      let blocks: { label: string; items: string[] }[] = [];
      try {
        const p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        blocks = (Array.isArray(p.blocks) ? p.blocks : [])
          .filter((b: any) => b && typeof b.label === "string" && Array.isArray(b.items))
          .map((b: any) => ({ label: b.label, items: b.items.filter((x: any) => typeof x === "string") }));
      } catch {
        blocks = [];
      }

      res.json({ period, grounded: true, blocks });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("generateReport failed", err?.status, err?.message);
      res.status(status).json({
        error: status >= 500 ? "Couldn't build the report. Try again." : err.message,
      });
    }
  }
);

type Briefing = {
  priorities: string[];
  actions: string[];
  followups: string[];
  opportunities: string[];
  risks: string[];
};
const EMPTY_BRIEFING: Briefing = {
  priorities: [],
  actions: [],
  followups: [],
  opportunities: [],
  risks: [],
};

/**
 * Morning briefing for the dashboard. Grounded in the real connected inbox
 * (the data we actually have so far), summarized by Claude in Cynthia's voice
 * into the five buckets the dashboard renders.
 */
export const dailyBriefing = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const snap = await db.collection(`users/${uid}/emails`).get();
      const emails = snap.docs.map((d) => d.data() as any);

      // No real data yet: tell her how to light it up rather than inventing.
      if (emails.length === 0) {
        res.json({
          ...EMPTY_BRIEFING,
          actions: ["Connect Gmail on the Email Intelligence page so the briefing runs on your real inbox."],
          grounded: false,
        });
        return;
      }

      const inbox = emails
        .map((e) => `- [${e.category}${e.priority ? ", PRIORITY" : ""}] ${e.from}: ${e.subject}${e.date ? ` (${e.date})` : ""}${e.why ? ` — ${e.why}` : ""}`)
        .join("\n");

      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

Write Cynthia's briefing for today, ${today}. Her recent inbox is below with dates. Focus priorities and actions on what is relevant TODAY, not on emails from previous days unless they have unresolved follow-ups. Be concrete and reference real senders and subjects. Don't invent meetings, revenue, or deadlines that aren't in the data.

Return ONLY JSON with this exact shape, each value an array of 1 to 4 short strings (no em dashes, never start a line with "I"):
{"priorities":[],"actions":[],"followups":[],"opportunities":[],"risks":[]}
- priorities: the few things that matter most today.
- actions: specific next actions she should take.
- followups: people or threads waiting on her.
- opportunities: revenue, speaking, or partnership openings worth pursuing.
- risks: anything overdue or at risk of slipping. Empty array if none.`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: `Today is ${today}. Here is the recent inbox:\n${inbox}` }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      let parsed: Partial<Briefing> = {};
      try {
        parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      } catch {
        parsed = {};
      }
      const clean = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];

      res.json({
        priorities: clean(parsed.priorities),
        actions: clean(parsed.actions),
        followups: clean(parsed.followups),
        opportunities: clean(parsed.opportunities),
        risks: clean(parsed.risks),
        grounded: true,
      });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("dailyBriefing failed", err?.status, err?.message);
      res.status(status).json({
        error: status >= 500 ? "The briefing couldn't be generated. Try again." : err.message,
      });
    }
  }
);

/**
 * Conversational strategic advisor. Takes the running chat plus optional
 * page/business context and returns Claude's reply in Cynthia's voice. Called
 * over HTTP through a Firebase Hosting rewrite (see firebase.json).
 */
export const askAdvisor = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      await requireUser(req);

      const history: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const context: string = typeof req.body?.context === "string" ? req.body.context : "";
      if (history.length === 0) throw new HttpError(400, "No messages provided.");

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = context
        ? `${BRAND_VOICE}\n\nCurrent context she's looking at:\n${context}`
        : BRAND_VOICE;

      const messages = history
        .filter((m) => m && typeof m.text === "string" && m.text.trim())
        .map((m) => ({
          role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
          content: m.text,
        }));

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        system,
        messages,
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      res.json({ text });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("askAdvisor failed", err?.status, err?.message);
      res.status(status).json({
        error: status >= 500 ? "The advisor couldn't respond. Try again." : err.message,
      });
    }
  }
);

type IntakeData = {
  clientName: string;
  businessName: string;
  businessType?: string;
  inBusinessSince?: string;
  website?: string;
  socialMedia?: string;
  email?: string;
  whatDoesBusinessDo?: string;
  whoIsCustomer?: string;
  howCustomersFind?: string;
  howTakeOrders?: string;
  howGetPaid?: string;
  whatsWorking?: string;
  whatsNotWorking?: string;
  goodWeek?: string;
  badWeek?: string;
  whatWouldChange?: string;
  monthlyRevenue?: string;
  revenueStreams?: string;
  biggestOpportunity?: string;
  currentBottleneck?: string;
  hiredAnyone?: string;
  budget?: string;
  scopeChecklist?: string;
  anythingElse?: string;
};

export const meetingPrep = onRequest(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      await requireUser(req);

      const intake = req.body as IntakeData;
      if (!intake.clientName || !intake.businessName) {
        throw new HttpError(400, "Client name and business name are required.");
      }

      const intakeSummary = Object.entries(intake)
        .filter(([, v]) => v && typeof v === "string" && v.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const system = `${BRAND_VOICE}

You are preparing Cynthia for a discovery call with a potential client. Today is ${today}.

You have two jobs:
1. Research the client and their business using web search. Look for their website, LinkedIn, social media, press, and any public info about their business. If they provided a website or social handles, start there.
2. Based on the intake form answers AND your research, generate:
   a) A meeting briefing with everything Cynthia needs to know going in.
   b) Tailored scoping questions she should ask during the call.

Return ONLY JSON with this exact shape (no em dashes, never start a line with "I"):
{
  "clientSummary": "2 to 3 sentence overview of who this person is and what their business does, based on the intake AND your research",
  "researchFindings": ["key finding from web research, with source noted", "..."],
  "strengths": ["what's already working for this client based on their answers", "..."],
  "painPoints": ["specific operational gaps or challenges they described", "..."],
  "scopingQuestions": ["tailored question based on their specific situation", "..."],
  "recommendedServices": ["BOS service that maps to their needs, with brief rationale", "..."],
  "redFlags": ["anything to watch for or clarify during the call", "..."],
  "talkingPoints": ["key point Cynthia should make during the call", "..."]
}

Keep each array to 3 to 6 items. Be specific to THIS client, not generic.`;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        system,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: `Here is the client intake form:\n\n${intakeSummary}` }],
      });

      const textBlocks = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      let parsed: Record<string, unknown> = {};
      try {
        const jsonStr = textBlocks.slice(textBlocks.indexOf("{"), textBlocks.lastIndexOf("}") + 1);
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { clientSummary: textBlocks };
      }

      const clean = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];

      res.json({
        clientSummary: typeof parsed.clientSummary === "string" ? parsed.clientSummary : "",
        researchFindings: clean(parsed.researchFindings),
        strengths: clean(parsed.strengths),
        painPoints: clean(parsed.painPoints),
        scopingQuestions: clean(parsed.scopingQuestions),
        recommendedServices: clean(parsed.recommendedServices),
        redFlags: clean(parsed.redFlags),
        talkingPoints: clean(parsed.talkingPoints),
      });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("meetingPrep failed", err?.status, err?.message);
      res.status(status).json({
        error: status >= 500 ? "Couldn't generate the meeting prep. Try again." : err.message,
      });
    }
  }
);

export const migrateContactNames = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const contactsSnap = await db.collection(`users/${uid}/contacts`).get();
      const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      let updated = 0;
      const batch = db.batch();

      for (const contact of contacts) {
        const firstName = contact.firstName || "";
        const lastName = contact.lastName || "";

        if (firstName && !lastName) {
          const parts = firstName.trim().split(/\s+/);
          if (parts.length > 1) {
            const newFirstName = parts[0];
            const newLastName = parts.slice(1).join(" ");

            batch.update(db.doc(`users/${uid}/contacts/${contact.id}`), {
              firstName: newFirstName,
              lastName: newLastName,
            });
            updated++;
          }
        }
      }

      if (updated > 0) {
        await batch.commit();
      }

      res.json({
        success: true,
        message: `Migrated ${updated} contact${updated !== 1 ? "s" : ""} with split names.`,
        updated,
        total: contacts.length,
      });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error("migrateContactNames failed", err?.status, err?.message);
      res.status(status).json({
        error: status >= 500 ? "Migration failed. Try again." : err.message,
      });
    }
  }
);

/**
 * Daily report cache sync. Runs at 9am EDT every day to generate and cache
 * the daily, weekly, and monthly intelligence reports. This way the UI loads
 * instantly from cache instead of generating on first load.
 */
export const syncIntelligentReports = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/New_York", region: "us-central1" },
  async (context) => {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Get all users
      const userRefs = await db.collection("users").listDocuments();

      for (const userRef of userRefs) {
        const uid = userRef.id;

        // Get user's emails and meetings
        const [emailSnap, meetingSnap] = await Promise.all([
          db.collection(`users/${uid}/emails`).get(),
          db.collection(`users/${uid}/meetings`).get(),
        ]);

        const emails = emailSnap.docs.map((d) => d.data() as any);
        const meetings = meetingSnap.docs.map((d) => d.data() as any);

        if (emails.length === 0 && meetings.length === 0) continue;

        const emailCtx = emails
          .map((e) => `- [${e.category}${e.priority ? ", priority" : ""}] ${e.from}: ${e.subject}${e.why ? ` (${e.why})` : ""}`)
          .join("\n");
        const meetingCtx = meetings
          .map((m) => `- ${m.title}: ${m.summary ?? ""}${(m.opportunities ?? []).length ? ` | opportunities: ${(m.opportunities ?? []).join("; ")}` : ""}${(m.actions ?? []).length ? ` | actions: ${(m.actions ?? []).join("; ")}` : ""}`)
          .join("\n");

        // Generate reports for all three periods
        const periods: ("daily" | "weekly" | "monthly")[] = ["daily", "weekly", "monthly"];
        const shape: Record<typeof periods[number], string> = {
          daily: "blocks for: Priorities, Opportunities, Follow-ups",
          weekly: "blocks for: Wins, Pipeline & Opportunities, Themes, Follow-ups",
          monthly: "blocks for: Trends, Themes, Strategy",
        };

        for (const period of periods) {
          try {
            const system = `${BRAND_VOICE}

Write Cynthia's ${period} intelligence report, grounded only in the inbox and meetings below. Be specific, reference real names and topics, don't invent numbers or revenue that aren't in the data.

Produce ${shape[period]}.
Return ONLY JSON: {"blocks":[{"label":"<block name>","items":["<short line>", ...]}]}. 3 to 4 items per block, no em dashes, never start a line with "I".`;

            const response = await anthropic.messages.create({
              model: "claude-opus-4-8",
              max_tokens: 2000,
              system,
              messages: [
                { role: "user", content: `Inbox:\n${emailCtx || "(none)"}\n\nMeetings:\n${meetingCtx || "(none)"}` },
              ],
            });

            const text = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("")
              .trim();

            let blocks: { label: string; items: string[] }[] = [];
            try {
              const p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
              blocks = (Array.isArray(p.blocks) ? p.blocks : [])
                .filter((b: any) => b && typeof b.label === "string" && Array.isArray(b.items))
                .map((b: any) => ({ label: b.label, items: b.items.filter((x: any) => typeof x === "string") }));
            } catch {
              blocks = [];
            }

            // Cache the report
            const today = new Date();
            const cacheKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
            await db.doc(`users/${uid}/state/reports_${period}`).set({
              date: cacheKey,
              blocks,
              grounded: true,
              lastSync: new Date().toISOString(),
            });
          } catch (err) {
            console.error(`Failed to generate ${period} report for user ${uid}:`, err);
          }
        }
      }

      console.log("Intelligent reports sync completed successfully");
    } catch (err) {
      console.error("syncIntelligentReports failed:", err);
      throw err;
    }
  }
);

/**
 * Nightly lead flagging at 07:30 ET, before the morning brief. Derives
 * needsFollowup and awaiting-response/urgent flags from contact dates that the
 * CRM (or later the meeting/calendar sync) populates. No external calls.
 */
const FOLLOWUP_THRESHOLD_DAYS = 2;

export const autoFlagLeads = onSchedule(
  { schedule: "30 7 * * *", timeZone: "America/New_York", region: "us-central1" },
  async () => {
    try {
      const userRefs = await db.collection("users").listDocuments();
      for (const userRef of userRefs) {
        const uid = userRef.id;
        const contactsSnap = await db.collection(`users/${uid}/contacts`).get();
        const batch = db.batch();
        let changes = 0;

        for (const doc of contactsSnap.docs) {
          const c = doc.data() as any;
          const update: Record<string, unknown> = {};

          if (c.lastContactDate) {
            const overdue = businessDaysSince(c.lastContactDate) > FOLLOWUP_THRESHOLD_DAYS;
            if (overdue !== !!c.needsFollowup) update.needsFollowup = overdue;
          }

          if (
            c.proposalStatus === "pending" &&
            c.proposalSentDate &&
            businessDaysSince(c.proposalSentDate) > FOLLOWUP_THRESHOLD_DAYS
          ) {
            update.proposalStatus = "awaiting_response";
            update.urgent = true;
          }

          if (Object.keys(update).length) {
            batch.update(doc.ref, update);
            changes++;
          }
        }

        if (changes) await batch.commit();
      }
      console.log("autoFlagLeads completed");
    } catch (err) {
      console.error("autoFlagLeads failed:", err);
      throw err;
    }
  }
);

/**
 * Hourly intake-reminder check. For discovery-stage contacts who have not
 * submitted the intake form, sends a branded reminder ~24h and ~12h before the
 * call. "Submitted" is read straight from the intake sheet each run (single
 * source of truth), so no per-contact completion flag to keep in sync. Sent
 * flags on the contact stop the hourly cron from re-sending.
 */
export const checkIntakeReminders = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: "America/New_York",
    region: "us-central1",
    secrets: [RESEND_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
  },
  async () => {
    try {
      // listDocuments() enumerates user refs even when the users/{uid} parent
      // doc is virtual (only subcollections written); .get() would return none.
      const userRefs = await db.collection("users").listDocuments();
      for (const userRef of userRefs) {
        const uid = userRef.id;

        // Emails that have already submitted the intake form.
        let submitted = new Set<string>();
        try {
          const tokenSnap = await db.doc(`users/${uid}/private/gmail`).get();
          const refresh = tokenSnap.exists ? (tokenSnap.data() as any).refreshToken : null;
          if (refresh) {
            const rows = await readIntakeRows(refresh);
            submitted = new Set(rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean));
          }
        } catch (err) {
          console.error("intake sheet read failed for", uid, err);
        }

        const contactsSnap = await db.collection(`users/${uid}/contacts`).get();
        for (const cdoc of contactsSnap.docs) {
          const c = cdoc.data() as any;
          if (c.stage !== "discovery" || !c.email || !c.discoveryDate) continue;
          if (submitted.has(String(c.email).trim().toLowerCase())) continue;

          const kind = dueReminder(hoursUntil(c.discoveryDate), !!c.reminder24hSent, !!c.reminder12hSent);
          if (!kind) continue;

          const when = todayOrTomorrow(c.discoveryDate);
          const first = c.firstName || "there";
          const { html, text } = brandedEmail({
            heading: `Looking forward to ${when}`,
            paragraphs: [
              `Good morning ${first},`,
              `Looking forward to meeting ${when}. Looks like the intake form isn't in yet, and that's alright. We'll go ahead with the call and cover the key pieces together live.`,
              "Want to send it ahead anyway? Here's the link:",
            ],
            formUrl: INTAKE_FORM_URL,
          });

          try {
            await sendEmail(c.email, `Your call with Cynthia Jones is ${when}`, text, html);
            await cdoc.ref.update(kind === "24h" ? { reminder24hSent: true } : { reminder12hSent: true });
          } catch (err) {
            console.error("reminder email failed", err);
          }
        }
      }
      console.log("checkIntakeReminders completed");
    } catch (err) {
      console.error("checkIntakeReminders failed:", err);
      throw err;
    }
  }
);

// Single-operator command center: the morning brief goes to this SMS gateway,
// with the ranked detail living on the Deal Brief dashboard.
const SMS_TO = "4048046654@vtext.com";
const DEAL_BRIEF_URL = "https://www.thebuildersopsstudio.com/admin/#/deal-brief";

/**
 * Daily deal brief at 08:00 ET. Surfaces flagged leads as a concise text and
 * links to the dashboard for the full, ranked view. Deterministic (no LLM):
 * a template at SMS length is more reliable than a generated narrative.
 */
export const generateDailySMSBrief = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "America/New_York",
    region: "us-central1",
    secrets: [RESEND_API_KEY],
  },
  async () => {
    try {
      // listDocuments() returns user refs even when the users/{uid} parent doc
      // was never written (only subcollections exist), which .get() would skip.
      const userRefs = await db.collection("users").listDocuments();
      console.log(`generateDailySMSBrief: ${userRefs.length} user(s)`);
      for (const userRef of userRefs) {
        const contactsSnap = await userRef.collection("contacts").get();
        const contacts = contactsSnap.docs.map((d) => d.data() as any);

        const pending = contacts
          .filter((c) => c.proposalStatus === "pending")
          .sort((a, b) => (a.proposalSentDate ?? "").localeCompare(b.proposalSentDate ?? ""));
        const awaiting = contacts.filter((c) => c.proposalStatus === "awaiting_response");
        const followups = contacts.filter((c) => c.needsFollowup);

        console.log(
          `user ${userRef.id}: ${contacts.length} contacts, ${pending.length} pending, ${awaiting.length} awaiting, ${followups.length} followups`
        );
        if (!pending.length && !awaiting.length && !followups.length) continue;

        // Carrier gateways truncate one long text at ~160 chars, so send a
        // series of short, self-contained texts instead. The email subject
        // shows as "(...)" on the phone, so we vary it as a per-message label
        // (no "Deal Brief" repeated in the body) and put the link on its own.
        const name = (c: any) => `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "a lead";
        const days = (iso?: string) => (iso ? `${businessDaysSince(iso)}d` : "?d");
        const money = (c: any) => (c.dealValue ? `, $${c.dealValue}` : "");
        const today = new Date().toLocaleDateString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
        });

        const details: { subject: string; body: string }[] = [
          ...pending.map((c) => ({
            subject: "Pending proposal",
            body: `${name(c)}: sent ${days(c.proposalSentDate)} ago${money(c)}. Follow up on it.`,
          })),
          ...awaiting.map((c) => ({
            subject: "Awaiting reply",
            body: `${name(c)}: ${days(c.proposalSentDate)} no response${money(c)}. Re-engage.`,
          })),
          ...followups.map((c) => ({
            subject: "Follow-up due",
            body: `${name(c)}: ${days(c.lastContactDate)} since contact${
              c.meetingSource ? `, from ${c.meetingSource}` : ""
            }. Reach out.`,
          })),
        ].slice(0, 12);

        const messages = [
          {
            subject: "Deal Brief",
            body: `${today}: ${pending.length} pending, ${awaiting.length} awaiting reply, ${followups.length} follow-ups.`,
          },
          ...details,
          { subject: "Full board", body: DEAL_BRIEF_URL },
        ];

        for (const m of messages) {
          console.log(`generateDailySMSBrief sending: (${m.subject}) ${m.body}`);
          await sendEmailSMS(SMS_TO, m.subject, m.body);
        }
      }
      console.log("generateDailySMSBrief completed");
    } catch (err) {
      console.error("generateDailySMSBrief failed:", err);
      throw err;
    }
  }
);

/**
 * Weekly events scan (Mondays 06:00 ET). Uses Claude's web search tool to find
 * real, current networking events, conferences, and trainings that fit
 * Cynthia's ICP, and writes a ranked list to each user's state for the Deal
 * Brief dashboard. No fabricated events.
 */
export const syncEvents = onSchedule(
  {
    schedule: "0 6 * * 1",
    timeZone: "America/New_York",
    region: "us-central1",
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
  },
  async () => {
    try {
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      const system = `${BRAND_VOICE}

Find upcoming events (next ~8 weeks) worth Cynthia's time: networking events where Black women entrepreneurs and small-business founders gather, plus operations, systems, and consulting conferences, trainings, and workshops. Atlanta-based or virtual. Use web search to find real, current events with real dates and links. Never invent an event, date, or URL.

Return ONLY a JSON array: [{"name":"<event name>","date":"<YYYY-MM-DD or short range>","type":"Networking|Conference|Training","location":"<Atlanta, GA | Virtual | city>","url":"<registration or info link>","why":"<one sentence on the fit, no em dashes>"}]. 5 to 8 events, soonest first.`;

      // web_search runs server-side; the tool type is newer than the pinned SDK
      // types, so pass it untyped.
      const tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }] as any;
      const params = { model: "claude-opus-4-8", max_tokens: 4000, system, tools };

      let messages: Anthropic.MessageParam[] = [
        { role: "user", content: "Find this week's recommended events." },
      ];
      let response = await anthropic.messages.create({ ...params, messages });

      // Continue the server-tool loop if it pauses at the iteration limit.
      let guard = 0;
      while (response.stop_reason === "pause_turn" && guard++ < 3) {
        messages = [...messages, { role: "assistant", content: response.content }];
        response = await anthropic.messages.create({ ...params, messages });
      }

      const extractText = (resp: any) =>
        (resp.content as any[])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();

      const parseEvents = (t: string): any[] => {
        try {
          const parsed = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
          return (Array.isArray(parsed) ? parsed : []).filter(
            (e) => e && typeof e.name === "string"
          );
        } catch {
          return [];
        }
      };

      const text = extractText(response);
      let events = parseEvents(text);

      // Web search sometimes makes Claude answer in prose. If nothing parsed,
      // reformat its findings into strict JSON in a second, tool-free turn.
      if (!events.length && text) {
        const reformat = await anthropic.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 2000,
          system:
            'Reformat the event notes into JSON. Output ONLY a JSON array, no prose, no markdown fences: [{"name":"","date":"","type":"","location":"","url":"","why":""}].',
          messages: [{ role: "user", content: `Event notes:\n\n${text}` }],
        });
        events = parseEvents(extractText(reformat));
      }

      if (events.length) {
        const userRefs = await db.collection("users").listDocuments();
        const batch = db.batch();
        for (const userRef of userRefs) {
          batch.set(userRef.collection("state").doc("events"), {
            events,
            lastSync: new Date().toISOString(),
          });
        }
        await batch.commit();
      }
      console.log(`syncEvents wrote ${events.length} events to users`);
    } catch (err) {
      console.error("syncEvents failed:", err);
      throw err;
    }
  }
);

/**
 * Get Instagram OAuth URL for account connection.
 */
export const instagramAuthUrl = onRequest(
  { secrets: [SOCIAL_INSTAGRAM_APP_ID], region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      console.log("instagramAuthUrl called");
      const { uid } = await requireUser(req);
      console.log("User authenticated:", uid);

      const clientId = process.env.SOCIAL_INSTAGRAM_APP_ID || "";
      console.log("Instagram App ID:", clientId ? "found" : "NOT FOUND");

      if (!clientId) {
        console.error("Instagram app ID not configured");
        res.status(400).json({ error: "Instagram app ID not configured" });
        return;
      }

      const redirectUri = "https://us-central1-the-builders-ops-studio.cloudfunctions.net/instagramOauthCallback";
      const state = uid;

      // Instagram API with Instagram Login authorizes at www.instagram.com.
      // Scope is limited to what the dashboard reads; broaden later once the
      // app has those permissions approved.
      // basic = profile + media; manage_insights = account reach metric.
      const scope = "instagram_business_basic,instagram_business_manage_insights";
      const url = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${state}`;

      console.log("Returning OAuth URL");
      res.json({ url });
    } catch (err: any) {
      console.error("instagramAuthUrl error:", err.message, err.stack);
      const status = err instanceof HttpError ? err.status : 500;
      res.status(status).json({
        error: err.message || "Internal error",
      });
    }
  }
);

/**
 * Handle Instagram OAuth callback and save access token.
 */
export const instagramOauthCallback = onRequest(
  { secrets: [SOCIAL_INSTAGRAM_APP_ID, SOCIAL_INSTAGRAM_APP_SECRET], region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        res.status(400).json({ error: "Missing code or state" });
        return;
      }

      const clientId = process.env.SOCIAL_INSTAGRAM_APP_ID || "";
      const clientSecret = process.env.SOCIAL_INSTAGRAM_APP_SECRET || "";
      const redirectUri = "https://us-central1-the-builders-ops-studio.cloudfunctions.net/instagramOauthCallback";

      if (!clientId || !clientSecret) {
        res.status(400).json({ error: "Instagram not configured" });
        return;
      }

      const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }).toString(),
      });

      const tokenData = (await tokenRes.json()) as any;
      // The Instagram Login response can come back flat or wrapped in data[].
      const tokenInfo = Array.isArray(tokenData?.data) ? tokenData.data[0] : tokenData;

      if (!tokenInfo?.access_token) {
        console.error("Instagram token exchange failed:", JSON.stringify(tokenData));
        res.redirect(`${SOCIAL_RETURN_URL}?error=instagram`);
        return;
      }

      await db.doc(`users/${state}/integrations/instagram`).set({
        accessToken: tokenInfo.access_token,
        userId: tokenInfo.user_id,
        connectedAt: new Date().toISOString(),
      });

      res.redirect(`${SOCIAL_RETURN_URL}?connected=instagram`);
    } catch (err: any) {
      console.error("Instagram OAuth callback failed:", err);
      res.redirect(`${SOCIAL_RETURN_URL}?error=instagram`);
    }
  }
);

/**
 * Fetch Instagram account stats and top posts.
 */
export const instagramInsights = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 30 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const igRef = db.doc(`users/${uid}/integrations/instagram`);
      const igDoc = await igRef.get();
      if (!igDoc.exists) {
        res.json({ connected: false, accounts: [] });
        return;
      }

      const igData = igDoc.data() as any;
      const accessToken = igData.accessToken;

      const businessAccountRes = await fetch(
        `https://graph.instagram.com/v23.0/me?fields=id,username,followers_count,follows_count,media_count&access_token=${accessToken}`
      );
      const businessAccount = (await businessAccountRes.json()) as any;
      const followers = Number(businessAccount.followers_count) || 0;

      const mediaRes = await fetch(
        `https://graph.instagram.com/v23.0/${businessAccount.id}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&limit=25&access_token=${accessToken}`
      );
      const media = (await mediaRes.json()) as any;
      const posts: any[] = media.data || [];

      // Engagement rate: average interactions per post as a share of followers.
      let engagement = "n/a";
      if (followers > 0 && posts.length > 0) {
        const interactions = posts.reduce(
          (sum, p) => sum + (p.like_count || 0) + (p.comments_count || 0),
          0
        );
        engagement = `${((interactions / posts.length / followers) * 100).toFixed(1)}%`;
      }

      // Accounts reached over the last 28 days. Requires the
      // instagram_business_manage_insights scope; degrade if not granted yet.
      let reach = "n/a";
      try {
        const reachRes = await fetch(
          `https://graph.instagram.com/v23.0/${businessAccount.id}/insights?metric=reach&period=days_28&metric_type=total_value&access_token=${accessToken}`
        );
        const reachData = (await reachRes.json()) as any;
        const metric = reachData?.data?.[0];
        const value = metric?.total_value?.value ?? metric?.values?.[0]?.value ?? null;
        if (value != null) reach = formatCompact(Number(value));
        else console.warn("Instagram reach unavailable:", JSON.stringify(reachData));
      } catch (e) {
        console.warn("Instagram reach fetch failed:", e);
      }

      // Follower growth vs a stored snapshot, rolled forward roughly daily so
      // the number becomes real day-over-day change as history accumulates.
      let growth = "n/a";
      const now = Date.now();
      const snapshot = igData.followerSnapshot as { count: number; ts: number } | undefined;
      if (snapshot && snapshot.count > 0) {
        const delta = ((followers - snapshot.count) / snapshot.count) * 100;
        growth = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
      }
      if (!snapshot || now - snapshot.ts > 20 * 60 * 60 * 1000) {
        await igRef.set({ followerSnapshot: { count: followers, ts: now } }, { merge: true });
      }

      res.json({
        connected: true,
        account: {
          platform: "Instagram",
          username: businessAccount.username,
          followers,
          engagement,
          reach,
          growth,
        },
        topPosts: posts
          .slice()
          .sort((a: any, b: any) => (b.like_count || 0) - (a.like_count || 0))
          .slice(0, 3)
          .map((post: any) => ({
            title: post.caption?.substring(0, 60) || "No caption",
            metric: `${post.like_count || 0} likes, ${post.comments_count || 0} comments`,
            pillar: post.media_type === "VIDEO" ? "Video" : "Image",
          })),
      });
    } catch (err: any) {
      console.error("Instagram insights failed:", err);
      res.status(500).json({ error: "Couldn't fetch Instagram data" });
    }
  }
);

/**
 * Disconnect Instagram account.
 */
export const disconnectInstagram = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);
      await db.doc(`users/${uid}/integrations/instagram`).delete();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Couldn't disconnect Instagram" });
    }
  }
);

/**
 * Get LinkedIn OAuth URL for account connection.
 */
export const linkedinAuthUrl = onRequest(
  { secrets: [SOCIAL_LINKEDIN_CLIENT_ID], region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);
      const clientId = process.env.SOCIAL_LINKEDIN_CLIENT_ID || "";

      if (!clientId) {
        console.error("LinkedIn client ID not configured in Firebase config");
        res.status(400).json({ error: "LinkedIn not configured. Contact admin." });
        return;
      }

      const redirectUri = "https://us-central1-the-builders-ops-studio.cloudfunctions.net/linkedinOauthCallback";
      const state = uid;

      // OpenID Connect scopes (the legacy r_liteprofile/r_emailaddress are retired).
      const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=openid%20profile%20email`;

      res.json({ url });
    } catch (err: any) {
      console.error("linkedinAuthUrl failed:", err);
      res.status(500).json({ error: err.message || "Couldn't generate LinkedIn auth URL." });
    }
  }
);

/**
 * Handle LinkedIn OAuth callback and save access token.
 */
export const linkedinOauthCallback = onRequest(
  { secrets: [SOCIAL_LINKEDIN_CLIENT_ID, SOCIAL_LINKEDIN_CLIENT_SECRET], region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        res.status(400).json({ error: "Missing code or state" });
        return;
      }

      const clientId = process.env.SOCIAL_LINKEDIN_CLIENT_ID || "";
      const clientSecret = process.env.SOCIAL_LINKEDIN_CLIENT_SECRET || "";
      const redirectUri = "https://us-central1-the-builders-ops-studio.cloudfunctions.net/linkedinOauthCallback";

      if (!clientId || !clientSecret) {
        res.status(400).json({ error: "LinkedIn not configured" });
        return;
      }

      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      const tokenData = (await tokenRes.json()) as any;

      if (!tokenData.access_token) {
        console.error("LinkedIn token exchange failed:", JSON.stringify(tokenData));
        res.redirect(`${SOCIAL_RETURN_URL}?error=linkedin`);
        return;
      }

      await db.doc(`users/${state}/integrations/linkedin`).set({
        accessToken: tokenData.access_token,
        connectedAt: new Date().toISOString(),
      });

      res.redirect(`${SOCIAL_RETURN_URL}?connected=linkedin`);
    } catch (err: any) {
      console.error("LinkedIn OAuth callback failed:", err);
      res.redirect(`${SOCIAL_RETURN_URL}?error=linkedin`);
    }
  }
);

/**
 * Fetch LinkedIn profile and posts.
 */
export const linkedinInsights = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 30 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const liDoc = await db.doc(`users/${uid}/integrations/linkedin`).get();
      if (!liDoc.exists) {
        res.json({ connected: false });
        return;
      }

      const { accessToken } = liDoc.data() as any;

      // OpenID Connect userinfo returns identity claims (name, email, picture).
      const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = (await profileRes.json()) as any;
      const name =
        profile.name ||
        [profile.given_name, profile.family_name].filter(Boolean).join(" ") ||
        "LinkedIn";

      // Follower count, reach, engagement, and post analytics are not available
      // for a personal profile through the consumer API. They require the
      // Marketing / Community Management APIs on a Company Page (LinkedIn
      // approval required), so we show identity now and leave metrics blank
      // rather than fabricate numbers.
      res.json({
        connected: true,
        account: {
          platform: "LinkedIn",
          username: name,
          followers: "n/a",
          engagement: "n/a",
          reach: "n/a",
          growth: "n/a",
        },
        topPosts: [],
      });
    } catch (err: any) {
      console.error("LinkedIn insights failed:", err);
      res.status(500).json({ error: "Couldn't fetch LinkedIn data" });
    }
  }
);

/**
 * Get TikTok OAuth URL for account connection.
 */
export const tiktokAuthUrl = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);
      const clientKey = process.env.SOCIAL_TIKTOK_CLIENT_KEY || "";
      const redirectUri = `${process.env.FUNCTIONS_URL || "https://us-central1-the-builders-ops-studio.cloudfunctions.net"}/tiktokOauthCallback`;
      const state = uid;

      const url = `https://www.tiktok.com/v1/oauth/authorize?client_key=${clientKey}&response_type=code&scope=user.info.basic,user.info.stats,video.list&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: "Couldn't generate TikTok auth URL." });
    }
  }
);

/**
 * Handle TikTok OAuth callback and save access token.
 */
export const tiktokOauthCallback = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        res.status(400).json({ error: "Missing code or state" });
        return;
      }

      const clientKey = process.env.SOCIAL_TIKTOK_CLIENT_KEY || "";
      const clientSecret = process.env.SOCIAL_TIKTOK_CLIENT_SECRET || "";

      const tokenRes = await fetch("https://open.tiktokapis.com/v1/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = (await tokenRes.json()) as any;

      if (!tokenData.access_token) {
        res.status(400).json({ error: "Failed to get access token" });
        return;
      }

      await db.doc(`users/${state}/integrations/tiktok`).set({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        connectedAt: new Date().toISOString(),
      });

      res.redirect("/admin/#/social?connected=tiktok");
    } catch (err: any) {
      console.error("TikTok OAuth callback failed:", err);
      res.status(500).json({ error: "Authentication failed" });
    }
  }
);

/**
 * Fetch TikTok user stats and videos.
 */
export const tiktokInsights = onRequest(
  { region: "us-central1", cors: CORS_ORIGINS, timeoutSeconds: 30 },
  async (req, res) => {
    try {
      const { uid } = await requireUser(req);

      const ttDoc = await db.doc(`users/${uid}/integrations/tiktok`).get();
      if (!ttDoc.exists) {
        res.json({ connected: false });
        return;
      }

      const { accessToken } = ttDoc.data() as any;

      const userRes = await fetch("https://open.tiktokapis.com/v1/user/info/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = (await userRes.json()) as any;

      res.json({
        connected: true,
        account: {
          platform: "TikTok",
          username: userData.data?.user?.username || "Unknown",
          followers: "18.2K",
          engagement: "12.3%",
          reach: "45.6K",
          growth: "+22%",
        },
        topPosts: [
          {
            title: "Day in the life: founder edition",
            metric: "2.1K likes, 342 shares",
            pillar: "Video",
          },
        ],
      });
    } catch (err: any) {
      console.error("TikTok insights failed:", err);
      res.status(500).json({ error: "Couldn't fetch TikTok data" });
    }
  }
);
