import { auth } from "./firebase";

// The backend runs as HTTP functions behind Firebase Hosting rewrites on the
// web.app domain. We call it from here (GitHub Pages) cross-origin with the
// Firebase ID token. Routing through Hosting means the functions never need to
// be publicly invokable, which the Workspace org policy forbids.
const API_BASE = "https://the-builders-ops-studio.web.app";

export async function callApi<T>(name: string, data?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required.");
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}/api/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}
