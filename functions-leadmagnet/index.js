const fs = require("fs");
const path = require("path");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// From must be on a Resend-verified domain (thebuildersopsstudio.com is verified).
const FROM = "Cynthia Jones <cynthia@thebuildersopsstudio.com>";
const PDF_NAME = "BOS_Operational_Gaps_Self_Audit.pdf";
const PDF_B64 = fs.readFileSync(path.join(__dirname, PDF_NAME)).toString("base64");

// cors: the marketing site is served from GitHub Pages (a different origin).
const ALLOWED_ORIGINS = ["https://www.thebuildersopsstudio.com", "https://thebuildersopsstudio.com"];

const isValidEmail = (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function buildEmail(to, firstName) {
  const name = (firstName || "").trim();
  const hi = name ? `Hi ${name},` : "Hi there,";
  return {
    from: FROM,
    to: [to.trim()],
    subject: "Your Operational Gaps Self-Audit is here",
    html: `<div style="font-family:Georgia,serif;color:#2C2C28;line-height:1.7;max-width:520px">
      <p>${hi}</p>
      <p>Thank you for requesting the <strong>Operational Gaps Self-Audit</strong>. It is attached to this email as a PDF.</p>
      <p>Work through it honestly. Every gap you name is a lever for growth, and I would love to help you close them.</p>
      <p>Warmly,<br>Cynthia Jones<br><em>The Builders Ops Studio</em></p>
    </div>`,
    attachments: [{ filename: PDF_NAME, content: PDF_B64 }],
  };
}

exports.sendAudit = onRequest(
  { region: "us-central1", secrets: [RESEND_API_KEY], cors: ALLOWED_ORIGINS },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (req.body && req.body._gotcha) return res.json({ ok: true }); // honeypot: pretend success

    const { email, first_name } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: "A valid email is required." });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildEmail(email, first_name)),
    });

    if (!r.ok) {
      console.error("Resend error", r.status, await r.text());
      return res.status(502).json({ error: "Could not send the email. Please try again." });
    }
    return res.json({ ok: true });
  }
);

// ponytail: one runnable check for the only non-trivial logic (validation + payload).
if (require.main === module) {
  const assert = require("assert");
  assert(isValidEmail("a@b.co") && !isValidEmail("nope") && !isValidEmail(""));
  const m = buildEmail("Jane@Example.com ", " Jane ");
  assert(m.to[0] === "Jane@Example.com" && m.html.includes("Hi Jane,"));
  assert(m.attachments[0].content.length > 1000 && m.attachments[0].filename === PDF_NAME);
  console.log("ok");
}
