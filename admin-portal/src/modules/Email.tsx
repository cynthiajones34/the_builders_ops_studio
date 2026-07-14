import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, Sparkles, Star, RefreshCw, AlertCircle } from "lucide-react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type EmailDoc = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  category: string;
  priority: boolean;
  why?: string;
  date?: string;
};

type GmailMeta = {
  connected?: boolean;
  connectedEmail?: string | null;
  accounts?: Array<{ email: string; connectedAt: number }>;
  lastSync?: number;
  count?: number;
};

// Category → accent color, mirroring the prototype's tone system.
const TONE: Record<string, "danger" | "clay" | "positive" | "neutral" | "warning"> = {
  "Potential Client": "danger",
  Speaking: "clay",
  Partnership: "positive",
  Media: "neutral",
  Networking: "clay",
  Invoice: "warning",
  Admin: "neutral",
};
const DOT: Record<string, string> = {
  danger: "#A0522D",
  clay: "#C4956A",
  positive: "#4F7A4F",
  warning: "#B8860B",
  neutral: "#E8DCC8",
};

function senderName(from: string) {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<.*>$/);
  return (m ? m[1] : from.replace(/<.*>/, "")).trim() || from;
}

function whenLabel(date?: string) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function lastSyncLabel(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Email() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [emails, setEmails] = useState<EmailDoc[]>([]);
  const [meta, setMeta] = useState<GmailMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "connect" | "sync">(null);
  const [error, setError] = useState<string | null>(null);

  // Live subscriptions to the user's categorized inbox + connection state.
  useEffect(() => {
    if (!user) return;
    const unsubEmails = onSnapshot(collection(db, "users", user.uid, "emails"), (snap) => {
      setEmails(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmailDoc, "id">) })));
      setLoaded(true);
    });
    const unsubMeta = onSnapshot(doc(db, "users", user.uid, "meta", "gmail"), (snap) => {
      setMeta(snap.exists() ? (snap.data() as GmailMeta) : null);
    });
    return () => {
      unsubEmails();
      unsubMeta();
    };
  }, [user]);

  async function sync() {
    setBusy("sync");
    setError(null);
    try {
      await callApi<{ count: number }>("syncGmail");
    } catch (e: any) {
      setError(e?.message ?? "Sync failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  // Handle the return trip from Google's consent screen.
  useEffect(() => {
    const status = params.get("gmail");
    if (!status) return;
    if (status === "connected") {
      // Newly linked. Pull the inbox right away.
      sync();
    } else if (status === "error") {
      setError("Gmail connection didn't complete. Try Connect Gmail again.");
    }
    params.delete("gmail");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const { url } = await callApi<{ url: string }>("gmailAuthUrl");
      window.location.assign(url);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't start the Gmail connection.");
      setBusy(null);
    }
  }

  const sorted = useMemo(
    () =>
      [...emails].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        return (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0);
      }),
    [emails]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of emails) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, tone: TONE[name] ?? "neutral" }))
      .sort((a, b) => b.count - a.count);
  }, [emails]);

  const priorityCount = emails.filter((e) => e.priority).length;
  const connected = !!meta?.connected;

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Email Intelligence"
        sub="Gmail, sorted by what it means for the business. Opportunities surface themselves."
        right={
          connected ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => busy === null && connect()}>
                <Mail size={15} /> {busy === "connect" ? "Opening Google…" : "Add account"}
              </Button>
              <Button variant="secondary" onClick={() => busy === null && sync()}>
                <RefreshCw size={15} className={busy === "sync" ? "animate-spin" : ""} />
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => busy === null && connect()}>
              <Mail size={15} /> {busy === "connect" ? "Opening Google…" : "Connect Gmail"}
            </Button>
          )
        }
      />

      {error && (
        <Card className="mb-6 flex items-start gap-2 border-copper bg-clay-light">
          <AlertCircle size={16} className="mt-0.5 text-copper" />
          <p className="text-sm text-brown">{error}</p>
        </Card>
      )}

      {/* Not connected yet: branded empty state. */}
      {loaded && !connected && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Mail size={28} className="text-clay" />
          <p className="mt-3 max-w-md text-lg font-semibold text-brown">
            Connect your inbox to make this real.
          </p>
          <p className="mt-1 max-w-md text-sm text-brown-mid">
            Read-only access. Nothing gets sent or deleted. Claude sorts every email by what it
            means for the business and flags what needs you.
          </p>
          <Button variant="accent" className="mt-5" onClick={() => busy === null && connect()}>
            <Mail size={15} /> {busy === "connect" ? "Opening Google…" : "Connect Gmail"}
          </Button>
        </Card>
      )}

      {connected && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Categories */}
          <div className="lg:col-span-1">
            <Card>
              <Eyebrow>Auto-Categorized</Eyebrow>
              <div className="mt-2 space-y-1">
                {categories.length === 0 && (
                  <p className="px-2 py-2 text-sm text-brown-mid">No mail synced yet.</p>
                )}
                {categories.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-clay-light"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: DOT[c.tone] }}
                      />
                      <span className="text-sm text-brown">{c.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-brown-mid">{c.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-4 bg-brown text-cream">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={15} className="text-clay" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-clay">
                  AI noticed
                </p>
              </div>
              <p className="text-sm leading-snug text-cream/90">
                {priorityCount > 0
                  ? `${priorityCount} ${
                      priorityCount === 1 ? "email needs" : "emails need"
                    } your personal attention. They're starred at the top.`
                  : "Nothing urgent in the last sync. Inbox is calm."}
              </p>
            </Card>

            {meta?.lastSync && (
              <div className="mt-3 px-1 text-xs text-brown-mid">
                {(meta.accounts && meta.accounts.length > 0
                  ? meta.accounts.map((a) => a.email)
                  : meta.connectedEmail
                  ? [meta.connectedEmail]
                  : []
                ).map((email) => (
                  <p key={email}>{email}</p>
                ))}
                <p>last synced {lastSyncLabel(meta.lastSync)}</p>
              </div>
            )}
          </div>

          {/* Inbox */}
          <div className="lg:col-span-3">
            <Card className="!p-0">
              <div className="flex items-center justify-between border-b border-sand px-5 py-3">
                <Eyebrow>Priority Inbox</Eyebrow>
                <span className="text-xs text-brown-mid">Sorted by business impact</span>
              </div>
              {sorted.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-brown-mid">
                  {busy === "sync"
                    ? "Reading your inbox and sorting it…"
                    : "No mail yet. Hit Sync now to pull your recent inbox."}
                </div>
              ) : (
                <div className="divide-y divide-sand">
                  {sorted.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-light">
                      <Star
                        size={16}
                        className={
                          e.priority ? "mt-0.5 fill-clay text-clay" : "mt-0.5 text-sand"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-brown">
                            {senderName(e.from)}
                          </p>
                          <Badge tone={TONE[e.category] ?? "neutral"}>{e.category}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-brown">{e.subject}</p>
                        <p className="mt-0.5 truncate text-xs text-brown-mid">
                          {e.why || e.snippet}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-brown-mid">
                        {whenLabel(e.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
