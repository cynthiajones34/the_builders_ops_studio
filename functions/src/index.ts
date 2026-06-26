import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import { CORS_ORIGINS, HttpError, requireUser, db } from "./shared";

// Gmail → Email Intelligence integration (OAuth + sync + categorization).
export { gmailAuthUrl, gmailOauthCallback, syncGmail, syncMeetings } from "./gmail";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

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
        .map((e) => `- [${e.category}${e.priority ? ", PRIORITY" : ""}] ${e.from}: ${e.subject}${e.why ? ` (${e.why})` : ""}`)
        .join("\n");

      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const system = `${BRAND_VOICE}

Write Cynthia's morning briefing from her current inbox. Be concrete and reference real senders and subjects. Don't invent meetings, revenue, or deadlines that aren't in the data.

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
        messages: [{ role: "user", content: `Today's inbox:\n${inbox}` }],
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
