import { useEffect, useMemo, useState } from "react";
import { Bot } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
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
};

const stageTone: Record<string, any> = {
  "New Lead": "neutral",
  Qualified: "clay",
  Proposal: "warning",
  Won: "positive",
};

const statusToStage: Record<string, string> = {
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

  const pipeline = useMemo(() => {
    const stages = ["New Lead", "Qualified", "Proposal", "Won"];
    const grouped: Record<string, Prospect[]> = {};
    stages.forEach((s) => {
      grouped[s] = [];
    });

    prospects.forEach((p) => {
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
              ? `${prospects.length} prospects in pipeline. Last updated just now.`
              : "Loading prospects..."}
          </p>
        </div>
        <Button variant="ghost">View agent</Button>
      </Card>

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
