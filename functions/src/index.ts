import { onCall, HttpsError } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

// Gmail → Email Intelligence integration (OAuth + sync + categorization).
export { gmailAuthUrl, gmailOauthCallback, syncGmail } from "./gmail";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// Only these accounts may call the AI backend. Mirrors the client allowlist;
// this is the real enforcement (the client check is just UX).
const ALLOWED_EMAILS = [
  "cynthia@thebuildersopsstudio.com",
  "cynthiajones34@gmail.com",
];

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

function assertAuthorized(auth: { token?: { email?: string } } | undefined) {
  const email = auth?.token?.email?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
    throw new HttpsError(
      "permission-denied",
      "This account isn't authorized for the BOS Command Center."
    );
  }
}

/**
 * Conversational strategic advisor. Takes the running chat plus optional
 * page/business context and returns Claude's reply in Cynthia's voice.
 */
export const askAdvisor = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: true },
  async (request) => {
    assertAuthorized(request.auth);

    const history: ChatMessage[] = Array.isArray(request.data?.messages)
      ? request.data.messages
      : [];
    const context: string =
      typeof request.data?.context === "string" ? request.data.context : "";

    if (history.length === 0) {
      throw new HttpsError("invalid-argument", "No messages provided.");
    }

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

    try {
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
      return { text };
    } catch (err: any) {
      console.error("askAdvisor: Claude call failed", err?.status, err?.message);
      throw new HttpsError("internal", "The advisor couldn't respond. Try again.");
    }
  }
);
