import { onRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import { CORS_ORIGINS, HttpError, requireUser, db } from "./shared";
import { sendEmail, brandedEmail, RESEND_API_KEY } from "./email";
import { readIntakeRows } from "./gmail";
import { INTAKE_FORM_URL, hoursUntil, dueReminder, todayOrTomorrow } from "./discovery";

// Gmail OAuth + intake form responses.
export { gmailAuthUrl, gmailOauthCallback, fetchIntakeResponses } from "./gmail";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const GOOGLE_OAUTH_CLIENT_ID = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");

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

const FOLLOWUP_THRESHOLD_DAYS = 2;

/**
 * Nightly lead flagging at 07:30 ET, before the morning brief. Derives
 * needsFollowup and awaiting-response/urgent flags from contact dates that the
 * CRM (or later the meeting/calendar sync) populates. No external calls.
 */
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
