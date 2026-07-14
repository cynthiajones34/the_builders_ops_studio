import { onRequest } from "firebase-functions/https";
import { db, CORS_ORIGINS } from "./shared";
import { sendEmail, RESEND_API_KEY } from "./email";

const REGION = "us-central1";
const OWNER_EMAIL = "cynthia@thebuildersopsstudio.com";

// Registration now runs on Stripe Payment Links straight from the landing page,
// so the custom Checkout flow (createSprintCheckout + sprintStripeWebhook) is
// gone. This waitlist capture is the only backend the Sprint still has.

/** Waitlist capture: stores the lead and emails Cynthia. No payment. */
export const joinSprintWaitlist = onRequest(
  { secrets: [RESEND_API_KEY], region: REGION, cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      const b = req.body ?? {};
      const t = (v: any) => (typeof v === "string" ? v.trim() : "");
      const name = t(b.name), email = t(b.email), business = t(b.business), gap = t(b.gap);
      if (!name || !email) { res.status(400).json({ error: "Please add your name and email." }); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "That email doesn't look right." }); return; }

      await db.collection("sprintWaitlist").add({ name, email, business, gap, createdAt: new Date().toISOString() });

      // Escape lead input before it lands in the notification HTML.
      const esc = (v: string) => v.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#3D2B1F">` +
        `<p><strong>${esc(name)}</strong> held a spot for the Sprint.</p>` +
        `<p>Business: ${esc(business) || "(not given)"}<br>Email: ${esc(email)}</p>` +
        (gap ? `<p>Biggest gap: "${esc(gap)}"</p>` : "") + `</div>`;
      const text = `${name} held a spot.\nBusiness: ${business || "(not given)"}\nEmail: ${email}${gap ? `\nGap: ${gap}` : ""}`;
      await sendEmail(OWNER_EMAIL, `Sprint interest: ${name}`, text, html).catch((e) =>
        console.error("waitlist notify failed", e?.message));

      res.json({ ok: true });
    } catch (err: any) {
      console.error("joinSprintWaitlist failed", err?.message);
      res.status(500).json({ error: "Couldn't save your spot. Please try again." });
    }
  }
);
