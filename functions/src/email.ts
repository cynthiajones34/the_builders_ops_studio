import { defineSecret } from "firebase-functions/params";
import { db } from "./shared";

// Resend API key. Bound on any function that sends mail.
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// Verified Resend sender on the studio domain. SMS gateway uses the system
// name; prospect-facing mail shows Cynthia's name over the same address.
const FROM_SYSTEM = "BOS Command Center <brief@thebuildersopsstudio.com>";
const FROM_CYNTHIA = "Cynthia Jones <brief@thebuildersopsstudio.com>";
const REPLY_TO = "cynthia@thebuildersopsstudio.com";

// One Resend POST, with the audit log + throw-on-failure that every caller wants.
async function post(payload: Record<string, unknown>, to: string, subject: string): Promise<void> {
  let status = "sent";
  let detail = "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      status = "failed";
      detail = `${res.status} ${await res.text()}`;
    }
  } catch (err: any) {
    status = "failed";
    detail = err?.message ?? String(err);
  }

  await db.collection("smsDeliveries").add({
    to,
    subject,
    status,
    detail,
    at: new Date().toISOString(),
  });

  if (status === "failed") throw new Error(`Email send failed: ${detail}`);
}

/** Plain-text email for the Verizon email-to-SMS gateway (the daily brief). */
export async function sendEmailSMS(to: string, subject: string, message: string): Promise<void> {
  await post({ from: FROM_SYSTEM, to: [to], subject, text: message }, to, subject);
}

/** Branded HTML email (with plain-text fallback) from Cynthia to a prospect. */
export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  await post({ from: FROM_CYNTHIA, reply_to: REPLY_TO, to: [to], subject, text, html }, to, subject);
}

/**
 * Render the studio's branded email: cream frame, white card, wordmark, body
 * paragraphs, an intake-form button plus a visible link, and Cynthia's
 * signature. Returns both the HTML and a plain-text fallback.
 */
export function brandedEmail(opts: { heading: string; paragraphs: string[]; formUrl: string }): {
  html: string;
  text: string;
} {
  const { heading, paragraphs, formUrl } = opts;
  const body = paragraphs
    .map((p) => `        <p style="margin:0 0 16px;">${p}</p>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3ede4;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;color:#3f3228;">
    <div style="background:#ffffff;border-radius:14px;padding:36px 34px;box-shadow:0 1px 3px rgba(63,50,40,.08);">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#a07d5a;font-family:Arial,Helvetica,sans-serif;">The Builders' Ops Studio</div>
      <h1 style="font-size:22px;line-height:1.3;margin:14px 0 22px;color:#3f3228;font-weight:normal;">${heading}</h1>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4a3d31;">
${body}
        <p style="margin:26px 0 12px;text-align:center;">
          <a href="${formUrl}" style="display:inline-block;background:#7a5c3e;color:#ffffff;text-decoration:none;font-size:15px;padding:13px 28px;border-radius:8px;">Complete the intake form</a>
        </p>
        <p style="margin:0 0 20px;text-align:center;font-size:13px;">Or paste this link: <a href="${formUrl}" style="color:#7a5c3e;">${formUrl}</a></p>
        <p style="margin:0 0 4px;">Talk soon,</p>
      </div>
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid #ece3d6;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#6b5a49;">
        <div style="font-weight:bold;color:#3f3228;">Cynthia Jones</div>
        <div>Founder, The Builders' Ops Studio</div>
        <div><a href="https://thebuildersopsstudio.com" style="color:#a07d5a;text-decoration:none;">thebuildersopsstudio.com</a></div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text =
    `${paragraphs.join("\n\n")}\n\n` +
    `Intake form: ${formUrl}\n\n` +
    `Talk soon,\n\nCynthia Jones\nFounder, The Builders' Ops Studio\nthebuildersopsstudio.com`;

  return { html, text };
}
