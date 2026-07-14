import { useEffect, useState } from "react";
import { Bot, Check, X, ExternalLink, Pencil } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type OutreachLog = {
  log_id: string;
  prospect_id: string;
  message_draft: string;
  outcome: string;
  was_edited: boolean;
  rejection_reason?: string;
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

type ActionModal = {
  type: "approve" | "decline" | null;
  prospectId: string;
  prospectName: string;
};

// Readiness from real prospect signals: ICP fit weighted, plus pain signals
// (capped). No proposal/deal data exists yet at the prospect stage, so we rank
// on what the SDR agent actually gathered rather than invent fields.
function readiness(p: ProspectWithOutreach): {
  score: number;
  label: string;
  tone: "positive" | "clay" | "warning";
} {
  const icp = p.icp_fit?.toLowerCase();
  const icpScore = icp === "yes" ? 2 : icp === "no" ? 0 : 1;
  const painScore = Math.min(p.pain_signals?.length ?? 0, 3);
  const score = icpScore * 2 + painScore;
  if (score >= 5) return { score, label: "Hot", tone: "positive" };
  if (score >= 3) return { score, label: "Warm", tone: "clay" };
  return { score, label: "Cool", tone: "warning" };
}

export default function Pipeline() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<ProspectWithOutreach[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModal>({ type: null, prospectId: "", prospectName: "" });
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");

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
    .sort((a, b) => {
      const byReadiness = readiness(b).score - readiness(a).score;
      if (byReadiness !== 0) return byReadiness;
      return (b.outreach?.log_id || "").localeCompare(a.outreach?.log_id || "");
    });

  async function handleApprove() {
    if (!user || !actionModal.prospectId) return;
    setIsProcessing(true);
    try {
      const prospect = prospects.find((p) => p.prospect_id === actionModal.prospectId);
      if (!prospect?.outreach?.log_id) return;

      await updateDoc(doc(db, "outreach_log", prospect.outreach.log_id), {
        outcome: "approved",
      });

      if (notes.trim()) {
        await addDoc(collection(db, "users", user.uid, "contacts"), {
          firstName: prospect.owner_name.split(" ")[0],
          lastName: prospect.owner_name.split(" ").slice(1).join(" "),
          email: "",
          phone: "",
          socialMedia: prospect.linkedin_url || prospect.instagram_handle || "",
          address: prospect.location || "",
          phase: "Prospect",
          tags: [],
          notes: notes.trim(),
          links: [],
          addedAt: Date.now(),
        });
      }

      setActionModal({ type: null, prospectId: "", prospectName: "" });
      setNotes("");
    } catch (err) {
      console.error("[Outreach] Approve failed:", err);
      alert(`Failed to approve: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDecline() {
    if (!actionModal.prospectId) return;
    setIsProcessing(true);
    try {
      const prospect = prospects.find((p) => p.prospect_id === actionModal.prospectId);
      if (!prospect?.outreach?.log_id) return;

      await updateDoc(doc(db, "outreach_log", prospect.outreach.log_id), {
        outcome: "declined",
        rejection_reason: notes.trim(),
      });

      setActionModal({ type: null, prospectId: "", prospectName: "" });
      setNotes("");
    } catch (err) {
      console.error("[Outreach] Decline failed:", err);
      alert(`Failed to decline: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function saveEditedMessage(logId: string) {
    if (!editedMessage.trim()) return;
    try {
      await updateDoc(doc(db, "outreach_log", logId), {
        message_draft: editedMessage.trim(),
        was_edited: true,
      });
      setEditingLogId(null);
      setEditedMessage("");
    } catch (err) {
      console.error("[Outreach] Save edit failed:", err);
      alert(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }


  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Outreach Approval"
        sub="Review prospect research and drafted messages from the BOS SDR agent, ranked by readiness (ICP fit and pain signals)."
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
            const r = readiness(prospect);
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
                      <Badge tone={r.tone}>{r.label} lead</Badge>
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
                  <div className="mb-2 flex items-center justify-between">
                    <Eyebrow>Drafted Message</Eyebrow>
                    {editingLogId !== prospect.outreach.log_id && (
                      <button
                        onClick={() => {
                          setEditingLogId(prospect.outreach?.log_id || null);
                          setEditedMessage(prospect.outreach?.message_draft || "");
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-clay hover:underline"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>
                  {editingLogId === prospect.outreach.log_id ? (
                    <div>
                      <textarea
                        value={editedMessage}
                        onChange={(e) => setEditedMessage(e.target.value)}
                        className="h-32 w-full resize-y rounded-lg border border-clay bg-white px-3 py-2 text-sm leading-relaxed text-brown outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          onClick={() => saveEditedMessage(prospect.outreach?.log_id || "")}
                          className="!text-xs !py-1"
                        >
                          <Check size={12} /> Save
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingLogId(null);
                            setEditedMessage("");
                          }}
                          className="!text-xs !py-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-brown">{prospect.outreach.message_draft}</p>
                  )}
                </div>
              )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() =>
                      setActionModal({
                        type: "approve",
                        prospectId: prospect.prospect_id,
                        prospectName: prospect.business_name,
                      })
                    }
                  >
                    <Check size={16} /> Approve & Send
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setActionModal({
                        type: "decline",
                        prospectId: prospect.prospect_id,
                        prospectName: prospect.business_name,
                      })
                    }
                    className="text-warning hover:text-copper"
                  >
                    <X size={16} /> Decline
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {actionModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-w-md">
            <Eyebrow>
              {actionModal.type === "approve"
                ? "Approve & Add to Contacts"
                : "Decline with Reason"}
            </Eyebrow>
            <p className="mt-2 text-sm text-brown-mid">{actionModal.prospectName}</p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                actionModal.type === "approve"
                  ? "Add notes for your contacts file (optional)"
                  : "Why are you declining? (helps improve future prospects)"
              }
              className="mt-4 h-24 w-full resize-none rounded-lg border border-sand bg-light px-3 py-2 text-sm text-brown outline-none focus:border-clay"
            />

            <div className="mt-4 flex gap-2">
              <Button
                onClick={actionModal.type === "approve" ? handleApprove : handleDecline}
                className={isProcessing ? "opacity-50" : ""}
              >
                {actionModal.type === "approve" ? (
                  <>
                    <Check size={14} /> Approve
                  </>
                ) : (
                  <>
                    <X size={14} /> Decline
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setActionModal({ type: null, prospectId: "", prospectName: "" });
                  setNotes("");
                }}
                className={isProcessing ? "opacity-50" : ""}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
