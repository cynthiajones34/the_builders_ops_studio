import { useEffect, useState } from "react";
import { Bot, Check, X, ExternalLink } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";

type OutreachLog = {
  log_id: string;
  prospect_id: string;
  message_draft: string;
  outcome: string;
  was_edited: boolean;
};

type ProspectWithOutreach = {
  prospect_id: string;
  business_name: string;
  owner_name: string;
  industry: string;
  location: string;
  linkedin_url?: string;
  instagram_handle?: string;
  website_url?: string;
  research_summary?: string;
  pain_signals?: string[];
  icp_fit?: string;
  outreach?: OutreachLog;
};

export default function Pipeline() {
  const [prospects, setProspects] = useState<ProspectWithOutreach[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "prospects"), (snap) => {
      const all = snap.docs.map((d) => ({
        prospect_id: d.id,
        ...(d.data() as Omit<ProspectWithOutreach, "prospect_id">),
      }));
      setProspects(all);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "outreach_log"), (snap) => {
      const all = snap.docs.map((d) => ({
        log_id: d.id,
        ...(d.data() as Omit<OutreachLog, "log_id">),
      }));
      setOutreachLogs(all);
    });
  }, []);

  const pendingOutreach = prospects
    .map((p) => ({
      ...p,
      outreach: outreachLogs.find((o) => o.prospect_id === p.prospect_id),
    }))
    .filter((p) => p.outreach && p.outreach.outcome === "no_reply")
    .sort((a, b) => (b.outreach?.log_id || "").localeCompare(a.outreach?.log_id || ""));

  async function approveMessage(logId: string) {
    setApproving(logId);
    try {
      await updateDoc(doc(db, "outreach_log", logId), {
        outcome: "approved",
      });
    } catch (err) {
      console.error("[Outreach] Approve failed:", err);
      alert(`Failed to approve: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setApproving(null);
    }
  }

  async function rejectMessage(logId: string) {
    setApproving(logId);
    try {
      await updateDoc(doc(db, "outreach_log", logId), {
        outcome: "declined",
      });
    } catch (err) {
      console.error("[Outreach] Reject failed:", err);
      alert(`Failed to reject: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setApproving(null);
    }
  }


  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Outreach Approval"
        sub="Review prospect research and drafted messages from the BOS SDR agent."
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
              ? `${pendingOutreach.length} message${pendingOutreach.length !== 1 ? "s" : ""} pending approval`
              : "Loading prospects..."}
          </p>
        </div>
      </Card>

      {loaded && pendingOutreach.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-sm text-brown-mid">No pending outreach messages. Run the SDR agent to discover leads.</p>
        </Card>
      )}

      {pendingOutreach.length > 0 && (
        <div className="space-y-4">
          {pendingOutreach.map((prospect) => {
            const icpStatus = prospect.icp_fit?.toLowerCase() || "unclear";
            const icpColor = icpStatus === "yes" ? "positive" : icpStatus === "no" ? "warning" : "clay";
            return (
              <Card key={prospect.outreach?.log_id} className={`border-l-4 ${
                icpStatus === "yes" ? "border-l-positive bg-positive/5" :
                icpStatus === "no" ? "border-l-warning bg-warning/5" :
                "border-l-clay"
              }`}>
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-brown">{prospect.business_name}</h3>
                      <Badge tone={icpColor}>
                        {icpStatus === "yes" ? "✓ ICP Match" : icpStatus === "no" ? "✗ Not ICP" : "? Unclear"}
                      </Badge>
                      {prospect.linkedin_url && (
                        <a href={prospect.linkedin_url} target="_blank" rel="noreferrer" className="text-clay hover:text-copper">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-brown-mid">{prospect.owner_name}</p>
                    <p className="text-xs text-brown-mid/60">{prospect.location}</p>
                  </div>
                </div>

              {prospect.research_summary && (
                <div className="mb-4 rounded-lg bg-light p-3">
                  <Eyebrow>Research Summary</Eyebrow>
                  <p className="mt-2 text-sm leading-relaxed text-brown-mid">{prospect.research_summary}</p>
                </div>
              )}

              {prospect.pain_signals && prospect.pain_signals.length > 0 && (
                <div className="mb-4">
                  <Eyebrow>Pain Signals</Eyebrow>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {prospect.pain_signals.map((signal) => (
                      <Badge key={signal} tone="warning">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {prospect.outreach?.message_draft && (
                <div className="mb-4 rounded-lg border border-sand bg-cream p-4">
                  <Eyebrow>Drafted Message</Eyebrow>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brown">{prospect.outreach.message_draft}</p>
                </div>
              )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => approveMessage(prospect.outreach?.log_id || "")}
                    className={`flex-1 ${approving === prospect.outreach?.log_id ? "opacity-50" : ""}`}
                  >
                    <Check size={16} /> Approve & Send
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => rejectMessage(prospect.outreach?.log_id || "")}
                    className={`flex-1 text-warning hover:text-copper ${approving === prospect.outreach?.log_id ? "opacity-50" : ""}`}
                  >
                    <X size={16} /> Decline
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
