import { useEffect, useMemo, useState } from "react";
import {
  Video,
  CheckSquare,
  Lightbulb,
  Flag,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type Meeting = {
  id: string;
  title: string;
  date?: string;
  summary?: string;
  actions?: string[];
  decisions?: string[];
  opportunities?: string[];
  docUrl?: string;
};

function whenLabel(date?: string) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function Meetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "connect" | "sync">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubM = onSnapshot(collection(db, "users", user.uid, "meetings"), (snap) => {
      setMeetings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meeting, "id">) })));
      setLoaded(true);
    });
    // Connection state is shared with Gmail (same Google account / token).
    const unsubConn = onSnapshot(doc(db, "users", user.uid, "meta", "gmail"), (snap) => {
      setConnected(snap.exists() ? Boolean((snap.data() as any).connected) : false);
    });
    const unsubMeta = onSnapshot(doc(db, "users", user.uid, "meta", "meetings"), (snap) => {
      setLastSync(snap.exists() ? ((snap.data() as any).lastSync ?? null) : null);
    });
    return () => {
      unsubM();
      unsubConn();
      unsubMeta();
    };
  }, [user]);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const { url } = await callApi<{ url: string }>("gmailAuthUrl");
      window.location.assign(url);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't start the Google connection.");
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    setError(null);
    try {
      await callApi<{ count: number }>("syncMeetings");
    } catch (e: any) {
      setError(e?.message ?? "Sync failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const sorted = useMemo(
    () =>
      [...meetings].sort(
        (a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0)
      ),
    [meetings]
  );

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Meeting Intelligence"
        sub="Your Google Meet notes, read for you. Every meeting becomes action items, decisions, and opportunities."
        right={
          connected ? (
            <Button variant="secondary" onClick={() => busy === null && sync()}>
              <RefreshCw size={15} className={busy === "sync" ? "animate-spin" : ""} />
              {busy === "sync" ? "Reading meetings…" : "Sync meetings"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => busy === null && connect()}>
              <Video size={15} /> {busy === "connect" ? "Opening Google…" : "Connect Google"}
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

      {loaded && !connected && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Video size={28} className="text-clay" />
          <p className="mt-3 max-w-md text-lg font-semibold text-brown">
            Connect Google to read your meetings.
          </p>
          <p className="mt-1 max-w-md text-sm text-brown-mid">
            Read-only. Claude reads your Gemini meeting notes and turns each one into action items,
            decisions, and opportunities.
          </p>
          <Button variant="accent" className="mt-5" onClick={() => busy === null && connect()}>
            <Video size={15} /> {busy === "connect" ? "Opening Google…" : "Connect Google"}
          </Button>
        </Card>
      )}

      {connected && (
        <>
          {lastSync && (
            <p className="mb-4 text-xs text-brown-mid">
              Last synced {new Date(lastSync).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}

          {sorted.length === 0 ? (
            <Card className="py-12 text-center text-sm text-brown-mid">
              {busy === "sync"
                ? "Reading your meeting notes and pulling out what matters…"
                : "No meetings yet. Hit Sync meetings to read your recent Google Meet notes."}
            </Card>
          ) : (
            <div className="space-y-5">
              {sorted.map((m) => (
                <Card key={m.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-xl font-bold text-brown">{m.title}</h2>
                        <Badge tone="positive">summarized</Badge>
                      </div>
                      <p className="text-xs text-brown-mid">{whenLabel(m.date)}</p>
                    </div>
                    {m.docUrl && (
                      <a
                        href={m.docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-copper hover:underline"
                      >
                        <ExternalLink size={14} /> Notes
                      </a>
                    )}
                  </div>

                  {m.summary && <p className="mt-3 text-sm italic text-brown-mid">{m.summary}</p>}

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <ExtractBlock icon={CheckSquare} label="Action Items" items={m.actions ?? []} />
                    <ExtractBlock icon={Flag} label="Decisions" items={m.decisions ?? []} />
                    <ExtractBlock
                      icon={Lightbulb}
                      label="Opportunities"
                      items={m.opportunities ?? []}
                      accent
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExtractBlock({
  icon: Icon,
  label,
  items,
  accent,
}: {
  icon: any;
  label: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-clay bg-clay-light/40" : "border-sand bg-light"}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={14} className="text-clay" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid">{label}</p>
      </div>
      <ul className="space-y-1.5">
        {items.length === 0 && <li className="text-xs italic text-brown-mid/50">None</li>}
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5 text-sm leading-snug text-brown">
            <span className="text-clay">·</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
