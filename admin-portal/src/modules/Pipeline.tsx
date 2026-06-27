import { useEffect, useMemo, useState } from "react";
import { Bot, Check, X } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type Prospect = {
  prospect_id: string;
  business_name: string;
  owner_name: string;
  status: string;
  industry: string;
  created_at: string;
  research_summary?: string;
  pain_signals?: string[];
};

const stageTone: Record<string, any> = {
  "New Lead": "neutral",
  Qualified: "clay",
  Proposal: "warning",
  Won: "positive",
};

const statusToStage: Record<string, string> = {
  pending: "Pending Approval",
  queued: "New Lead",
  flagged_review: "New Lead",
  approved: "Qualified",
  replied: "Qualified",
  sent: "Proposal",
  interested: "Proposal",
  meeting_booked: "Won",
  deal: "Won",
  rejected: "New Lead",
};

export default function Pipeline() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "prospects"), (snap) => {
      const all = snap.docs.map((d) => ({
        prospect_id: d.id,
        ...(d.data() as Omit<Prospect, "prospect_id">),
      }));
      setProspects(all);
      setLoaded(true);
    });
  }, [user]);

  async function approveProspect(prospectId: string) {
    if (!user) return;
    setApproving(prospectId);
    try {
      await updateDoc(doc(db, "users", user.uid, "prospects", prospectId), {
        status: "queued",
      });
    } finally {
      setApproving(null);
    }
  }

  async function rejectProspect(prospectId: string) {
    if (!user) return;
    setApproving(prospectId);
    try {
      await updateDoc(doc(db, "users", user.uid, "prospects", prospectId), {
        status: "rejected",
      });
    } finally {
      setApproving(null);
    }
  }

  const pendingApproval = useMemo(() => {
    return prospects.filter((p) => p.status === "pending");
  }, [prospects]);

  const pipeline = useMemo(() => {
    const stages = ["New Lead", "Qualified", "Proposal", "Won"];
    const grouped: Record<string, Prospect[]> = {};
    stages.forEach((s) => {
      grouped[s] = [];
    });

    prospects.forEach((p) => {
      if (p.status === "pending") return;
      const stage = statusToStage[p.status] || "New Lead";
      if (grouped[stage]) {
        grouped[stage].push(p);
      }
    });

    return stages.map((stage) => ({
      stage,
      deals: grouped[stage],
    }));
  }, [prospects]);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="BD Pipeline"
        sub="Prospects from first touch to won. New leads flow in from the BOS SDR agent automatically."
        right={
          <Button variant="secondary">
            <Bot size={15} /> SDR Agent: active
          </Button>
        }
      />

      <Card className="mb-6 flex items-center gap-4 border-clay bg-clay-light/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brown text-clay">
          <Bot size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-brown">BOS SDR Agent</p>
          <p className="text-xs text-brown-mid">
            {loaded
              ? `${prospects.length - pendingApproval.length} in pipeline. ${pendingApproval.length} awaiting approval.`
              : "Loading prospects..."}
          </p>
        </div>
        <Button variant="ghost">View agent</Button>
      </Card>

      {pendingApproval.length > 0 && (
        <Card className="mb-6 border-2 border-warning bg-warning/5">
          <Eyebrow>Approval Queue</Eyebrow>
          <p className="mt-1 mb-3 text-xs text-brown-mid">Review and approve prospects before they enter the pipeline.</p>
          <div className="space-y-3">
            {pendingApproval.map((prospect) => (
              <div key={prospect.prospect_id} className="flex items-start gap-3 rounded-lg border border-sand bg-light p-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brown">{prospect.business_name}</p>
                  <p className="text-xs text-brown-mid">{prospect.owner_name}</p>
                  {prospect.research_summary && (
                    <p className="mt-1 text-xs leading-relaxed text-brown-mid">{prospect.research_summary}</p>
                  )}
                  {prospect.pain_signals && prospect.pain_signals.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prospect.pain_signals.slice(0, 3).map((signal) => (
                        <Badge key={signal} tone="warning">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    onClick={() => approveProspect(prospect.prospect_id)}
                    className={`!px-2 !py-1.5 !text-xs ${approving === prospect.prospect_id ? "opacity-50" : ""}`}
                  >
                    <Check size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => rejectProspect(prospect.prospect_id)}
                    className={`!px-2 !py-1.5 !text-xs text-warning hover:text-copper ${approving === prospect.prospect_id ? "opacity-50" : ""}`}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loaded && prospects.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-sm text-brown-mid">No prospects yet. Run the SDR agent to discover leads.</p>
        </Card>
      )}

      {prospects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((col) => {
            const total = col.deals.length;
            return (
              <div key={col.stage}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background:
                          col.stage === "Won"
                            ? "#4F7A4F"
                            : col.stage === "Proposal"
                              ? "#B8860B"
                              : col.stage === "Qualified"
                                ? "#C4956A"
                                : "#E8DCC8",
                      }}
                    />
                    <p className="text-sm font-bold text-brown">{col.stage}</p>
                  </div>
                  <span className="text-xs text-brown-mid">{total}</span>
                </div>
                <div className="space-y-3">
                  {col.deals.map((p) => (
                    <Card key={p.prospect_id} className="!p-3">
                      <p className="text-sm font-semibold text-brown">{p.business_name}</p>
                      <p className="mt-0.5 text-xs text-brown-mid">{p.owner_name}</p>
                      <div className="mt-2">
                        <Badge tone={stageTone[col.stage]}>{p.industry}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
