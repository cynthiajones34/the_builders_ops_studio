import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Bot, ExternalLink } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type Prospect = {
  id: string;
  business_name?: string;
  owner_name?: string;
  industry?: string;
  location?: string;
  source?: string;
  status: string;
  linkedin_url?: string;
  instagram_handle?: string;
  research_summary?: string;
  pain_signals?: string[];
  ownership_confidence?: string;
  created_at?: string;
};

const STAGES: { key: string; label: string; tone: string; color: string }[] = [
  { key: "queued",         label: "New Leads",      tone: "neutral",  color: "#E8DCC8" },
  { key: "flagged_review", label: "Needs Review",   tone: "warning",  color: "#B8860B" },
  { key: "approved",       label: "Approved",       tone: "positive", color: "#4F7A4F" },
  { key: "sent",           label: "Outreach Sent",  tone: "clay",     color: "#C4956A" },
];

export default function Pipeline() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "prospects"), (snap) => {
      setProspects(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Prospect, "id">) }))
          .filter((p) => p.status !== "rejected")
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      );
      setLoaded(true);
    });
  }, [user]);

  async function setStatus(id: string, status: string) {
    await updateDoc(doc(db, "prospects", id), { status });
  }

  const byStage = (key: string) => prospects.filter((p) => p.status === key);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="BD Pipeline"
        sub="Your deals from first touch to won. New leads flow in from the BOS SDR agent automatically."
        right={
          <Button variant="secondary">
            <Bot size={15} /> SDR Agent: active
          </Button>
        }
      />

      {loaded && prospects.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Bot size={28} className="text-clay" />
          <p className="mt-3 text-lg font-semibold text-brown">No active prospects yet.</p>
          <p className="mt-1 text-sm text-brown-mid">The SDR agent will populate this as it runs.</p>
        </Card>
      )}

      {prospects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STAGES.map(({ key, label, color }) => {
            const stage = byStage(key);
            return (
              <div key={key}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    <p className="text-sm font-bold text-brown">{label}</p>
                  </div>
                  <span className="text-xs text-brown-mid">{stage.length}</span>
                </div>
                <div className="space-y-3">
                  {stage.map((p) => (
                    <div
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    >
                    <Card className="!p-3 hover:border-clay">
                      <p className="text-sm font-semibold text-brown">
                        {p.business_name || p.owner_name || "Unknown"}
                      </p>
                      {p.owner_name && p.business_name && (
                        <p className="text-xs text-brown-mid">{p.owner_name}</p>
                      )}
                      {p.industry && (
                        <div className="mt-1.5"><Badge tone="neutral">{p.industry}</Badge></div>
                      )}
                      {p.location && (
                        <p className="mt-1 text-[11px] text-brown-mid">{p.location}</p>
                      )}

                      {expanded === p.id && (
                        <div className="mt-3 space-y-2 border-t border-sand pt-3">
                          {p.research_summary && (
                            <p className="text-xs leading-snug text-brown-mid">{p.research_summary.slice(0, 200)}{p.research_summary.length > 200 ? "…" : ""}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {p.linkedin_url && (
                              <a href={p.linkedin_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-copper hover:underline"
                                onClick={(e) => e.stopPropagation()}>
                                <ExternalLink size={11} /> LinkedIn
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {STAGES.filter((s) => s.key !== key).map((s) => (
                              <button
                                key={s.key}
                                onClick={(e) => { e.stopPropagation(); setStatus(p.id, s.key); }}
                                className="rounded-lg border border-sand px-2 py-0.5 text-[11px] text-brown-mid hover:border-clay hover:text-brown"
                              >
                                Move → {s.label}
                              </button>
                            ))}
                            <button
                              onClick={(e) => { e.stopPropagation(); setStatus(p.id, "rejected"); }}
                              className="rounded-lg border border-sand px-2 py-0.5 text-[11px] text-brown-mid/60 hover:border-copper hover:text-copper"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </Card>
                    </div>
                  ))}
                  {stage.length === 0 && (
                    <p className="px-1 text-xs text-brown-mid/60">Empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
