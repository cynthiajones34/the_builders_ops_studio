import { useEffect, useState } from "react";
import { Target, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type Opportunity = {
  id: string;
  type: string;
  title: string;
  evidence?: string;
  value?: string;
  nextAction?: string;
};

const TONE: Record<string, "danger" | "clay" | "positive" | "neutral" | "warning"> = {
  Speaking: "positive",
  Partnership: "positive",
  "Potential Client": "danger",
  Workshop: "clay",
  "Productized Offer": "clay",
  Media: "neutral",
  Referral: "warning",
};

export default function Opportunities() {
  const { user } = useAuth();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "opportunities"), (snap) => {
      setOpps(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Opportunity, "id">) })));
      setLoaded(true);
    });
  }, [user]);

  async function scan() {
    setBusy(true);
    setError(null);
    try {
      await callApi<{ count: number }>("findOpportunities");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't scan. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Opportunity Engine"
        sub="Every revenue, speaking, and partnership signal pulled out of your real email and meetings."
        right={
          <Button variant="secondary" onClick={() => !busy && scan()}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            {busy ? "Scanning…" : "Scan now"}
          </Button>
        }
      />

      {error && (
        <Card className="mb-6 flex items-start gap-2 border-copper bg-clay-light">
          <AlertCircle size={16} className="mt-0.5 text-copper" />
          <p className="text-sm text-brown">{error}</p>
        </Card>
      )}

      {loaded && opps.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Target size={28} className="text-clay" />
          <p className="mt-3 max-w-md text-lg font-semibold text-brown">
            No opportunities scanned yet.
          </p>
          <p className="mt-1 max-w-md text-sm text-brown-mid">
            Connect Gmail and sync your meetings first, then scan. Claude pulls the revenue you
            haven't named yet out of what's already in your inbox and calls.
          </p>
          <Button variant="accent" className="mt-5" onClick={() => !busy && scan()}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            {busy ? "Scanning…" : "Scan now"}
          </Button>
        </Card>
      )}

      {opps.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {opps.map((o) => (
            <Card key={o.id} className="flex flex-col hover:border-clay">
              <div className="flex items-center justify-between">
                <Badge tone={TONE[o.type] ?? "neutral"}>{o.type}</Badge>
                {o.value && <span className="text-xs font-semibold text-clay">{o.value}</span>}
              </div>
              <h2 className="mt-3 font-display text-xl font-bold leading-snug text-brown">
                {o.title}
              </h2>
              {o.evidence && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-light p-2.5">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-clay" />
                  <p className="text-xs text-brown-mid">{o.evidence}</p>
                </div>
              )}
              {o.nextAction && (
                <p className="mt-3 text-sm text-brown">
                  <span className="font-semibold text-clay">Next: </span>
                  {o.nextAction}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
