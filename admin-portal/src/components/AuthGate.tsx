import { useState, type ReactNode } from "react";
import { Mail, Check } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, authorized, error, linkSentTo, sendLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-light">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sand border-t-clay" />
      </div>
    );
  }

  if (user && authorized) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await sendLink(email);
    setSending(false);
  }

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

        {linkSentTo ? (
          <div className="mt-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e3ede3] text-positive">
              <Check size={22} />
            </div>
            <p className="text-sm font-semibold text-brown">Check your email</p>
            <p className="mt-1 text-sm text-brown-mid">
              A sign-in link is on its way to{" "}
              <span className="font-semibold text-brown">{linkSentTo}</span>. Open it
              in this browser to finish.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-brown-mid">
              Private workspace. Enter your email and we'll send a one-click sign-in
              link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-sand bg-white px-3 py-2.5 focus-within:border-clay">
                <Mail size={16} className="text-brown-mid/60" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@thebuildersopsstudio.com"
                  className="flex-1 bg-transparent text-sm text-brown outline-none placeholder:text-brown-mid/40"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg bg-brown py-2.5 text-sm font-semibold text-cream transition hover:bg-brown-mid disabled:opacity-60"
              >
                {sending ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          </>
        )}

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
