import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Request } from "firebase-functions/https";

if (getApps().length === 0) initializeApp();
export const db = getFirestore();

// Only these accounts may use the Command Center. Enforced here on the real
// Firebase ID token; the client allowlist is just UX.
export const ALLOWED_EMAILS = [
  "cynthia@thebuildersopsstudio.com",
  "cynthiajones34@gmail.com",
  "cynthiadjones98@gmail.com",
];

// Browser origins allowed to call the API. The functions sit behind Firebase
// Hosting rewrites (so they never need public invoke), and the portal calls
// them cross-origin from these origins.
export const CORS_ORIGINS: (string | RegExp)[] = [
  "https://www.thebuildersopsstudio.com",
  "https://thebuildersopsstudio.com",
  "https://the-builders-ops-studio.web.app",
  /^http:\/\/localhost:\d+$/,
];

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token on the Authorization header and confirms the
 * caller is on the allowlist. Throws HttpError with the right status otherwise.
 */
export async function requireUser(req: Request): Promise<{ uid: string; email: string }> {
  const authz = (req.headers.authorization as string | undefined) ?? "";
  const m = authz.match(/^Bearer (.+)$/);
  if (!m) throw new HttpError(401, "Sign in required.");

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(m[1]);
  } catch {
    throw new HttpError(401, "Your session expired. Sign in again.");
  }

  const email = decoded.email?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    throw new HttpError(403, "This account isn't authorized for the BOS Command Center.");
  }
  return { uid: decoded.uid, email };
}
