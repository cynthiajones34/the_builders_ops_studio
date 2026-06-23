import type { ReactNode } from "react";
import { useAuth } from "../lib/AuthContext";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, authorized, error, signIn } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-light">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sand border-t-clay" />
      </div>
    );
  }

  if (user && authorized) return <>{children}</>;

  // Logged out, or signed in with a non-allowed account.
  return (
    <div className="flex h-screen items-center justify-center bg-brown px-6">
      <div className="w-full max-w-sm rounded-2xl bg-cream p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-brown font-display text-2xl font-bold text-clay">
          B
        </div>
        <h1 className="font-display text-2xl font-bold text-brown">
          Command Center
        </h1>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
          The Builders' Ops Studio
        </p>
        <p className="mt-4 text-sm text-brown-mid">
          Private workspace. Sign in to continue.
        </p>

        <button
          onClick={signIn}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-sand bg-white py-2.5 text-sm font-semibold text-brown transition hover:border-clay hover:bg-light"
        >
          <GoogleMark />
          Continue with Google
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-[#f1ddd2] px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <p className="mt-6 text-[11px] text-brown-mid/60">
          Access is restricted to authorized BOS accounts.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
