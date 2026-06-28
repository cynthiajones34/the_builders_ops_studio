import { useEffect, useState } from "react";
import {
  Target,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ClipboardList,
  Users,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  Check,
} from "lucide-react";
import { addDoc, collection, onSnapshot } from "firebase/firestore";
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

type IntakeResponse = {
  id: number;
  clientName: string;
  businessName: string;
  businessType: string;
  email: string;
  timestamp: string;
  raw: Record<string, string>;
};

type MeetingPrepResult = {
  clientSummary: string;
  researchFindings: string[];
  strengths: string[];
  painPoints: string[];
  scopingQuestions: string[];
  recommendedServices: string[];
  redFlags: string[];
  talkingPoints: string[];
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

  const [intakeResponses, setIntakeResponses] = useState<IntakeResponse[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<IntakeResponse | null>(null);
  const [prepResult, setPrepResult] = useState<MeetingPrepResult | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showOpps, setShowOpps] = useState(true);

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

  async function loadIntakeResponses() {
    setIntakeLoading(true);
    setIntakeError(null);
    try {
      const data = await callApi<{ responses: IntakeResponse[] }>("fetchIntakeResponses");
      setIntakeResponses(data.responses);
    } catch (e: any) {
      setIntakeError(e?.message ?? "Couldn't load intake responses.");
    } finally {
      setIntakeLoading(false);
    }
  }

  async function generatePrep(client: IntakeResponse) {
    setSelectedClient(client);
    setPrepResult(null);
    setPrepLoading(true);
    setPrepError(null);
    try {
      const raw = client.raw;
      const result = await callApi<MeetingPrepResult>("meetingPrep", {
        clientName: raw["Client Name"],
        businessName: raw["Business Name"],
        businessType: raw["Business Type"],
        inBusinessSince: raw["In Business Since"],
        website: raw["Website"],
        socialMedia: raw["Social Media Handles"],
        email: raw["Email"],
        whatDoesBusinessDo: raw["What does your business do?"],
        whoIsCustomer: raw["Who is your customer?"],
        howCustomersFind: raw["How do customers currently find you?"],
        howTakeOrders: raw["How do you currently take orders or bookings?"],
        howGetPaid: raw["How do you get paid?"],
        whatsWorking: raw["What's working well in your business right now?"],
        whatsNotWorking: raw["What's not working? Where do you feel stuck or overwhelmed?"],
        goodWeek: raw["What does a good week look like for your business?"],
        badWeek: raw["What does a bad week look like?"],
        whatWouldChange: raw["What would change if these challenges were fixed?"],
        monthlyRevenue: raw["Approximate Monthly Revenue"],
        revenueStreams: raw["Revenue Streams"],
        biggestOpportunity: raw["Biggest Revenue Opportunity"],
        currentBottleneck: raw["Current Bottleneck"],
        hiredAnyone: raw["Have you hired anyone?"],
        budget: raw["Budget for This Project"],
        anythingElse: raw["Is there anything else you'd like us to know before our discovery call?"],
      });
      setPrepResult(result);
      setSaved(false);
    } catch (e: any) {
      setPrepError(e?.message ?? "Couldn't generate meeting prep.");
    } finally {
      setPrepLoading(false);
    }
  }

  function formatPrepAsNotes(prep: MeetingPrepResult): string {
    const sections: string[] = [];
    sections.push(prep.clientSummary);
    const add = (label: string, items: string[]) => {
      if (items.length) sections.push(`\n${label}:\n${items.map((s) => `  - ${s}`).join("\n")}`);
    };
    add("Research Findings", prep.researchFindings);
    add("Strengths", prep.strengths);
    add("Pain Points", prep.painPoints);
    add("Scoping Questions", prep.scopingQuestions);
    add("Recommended Services", prep.recommendedServices);
    add("Red Flags", prep.redFlags);
    add("Talking Points", prep.talkingPoints);
    return sections.join("\n");
  }

  async function saveToKnowledgeBase() {
    if (!user || !prepResult || !selectedClient) return;
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit",
      });
      await addDoc(collection(db, "users", user.uid, "knowledge"), {
        title: `${selectedClient.clientName} - ${dateStr}`,
        type: "Reference",
        topic: "Meeting Prep",
        notes: `Saved ${dateStr} at ${timeStr}\n\n${formatPrepAsNotes(prepResult)}`,
        addedAt: Date.now(),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Opportunity Engine"
        sub="Discovery call prep, pipeline signals, and every revenue opening in one place."
      />

      {/* Meeting Prep Section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-clay" />
            <Eyebrow>Discovery Call Prep</Eyebrow>
          </div>
          <Button
            variant="secondary"
            onClick={loadIntakeResponses}
            className={intakeLoading ? "opacity-50" : ""}
          >
            <Users size={15} />
            {intakeLoading ? "Loading…" : "Pull intake forms"}
          </Button>
        </div>

        {intakeError && (
          <Card className="mb-4 flex items-start gap-2 border-copper bg-clay-light">
            <AlertCircle size={16} className="mt-0.5 text-copper" />
            <p className="text-sm text-brown">{intakeError}</p>
          </Card>
        )}

        {intakeResponses.length === 0 && !intakeLoading && (
          <Card className="mb-4 flex flex-col items-center justify-center py-10 text-center">
            <ClipboardList size={28} className="text-clay" />
            <p className="mt-3 text-lg font-semibold text-brown">No intake forms loaded yet.</p>
            <p className="mt-1 max-w-md text-sm text-brown-mid">
              Click "Pull intake forms" to load client responses from your Google Form.
              Select a client to generate a full discovery call briefing.
            </p>
          </Card>
        )}

        {intakeResponses.length > 0 && !selectedClient && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {intakeResponses.map((r) => (
              <button
                key={r.id}
                onClick={() => generatePrep(r)}
                className="rounded-2xl border border-sand bg-cream/80 p-5 text-left shadow-[0_1px_2px_rgba(61,43,31,0.04)] hover:border-clay"
              >
                <p className="text-sm font-semibold text-brown">{r.clientName}</p>
                <p className="mt-0.5 text-xs text-brown-mid">{r.businessName}</p>
                {r.businessType && (
                  <span className="mt-2 inline-flex items-center rounded-full bg-clay-light px-2.5 py-0.5 text-[11px] font-semibold text-copper">
                    {r.businessType}
                  </span>
                )}
                <p className="mt-2 text-[11px] text-brown-mid/60">{r.timestamp}</p>
              </button>
            ))}
          </div>
        )}

        {selectedClient && (
          <div className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={() => { setSelectedClient(null); setPrepResult(null); setPrepError(null); }}
                className="text-xs font-semibold text-clay hover:underline"
              >
                Back to all clients
              </button>
              <span className="text-xs text-brown-mid">
                Prep for {selectedClient.clientName} at {selectedClient.businessName}
              </span>
            </div>

            {prepLoading && (
              <Card className="flex items-center gap-3 py-8">
                <RefreshCw size={18} className="animate-spin text-clay" />
                <p className="text-sm text-brown-mid">
                  Researching {selectedClient.clientName} and building your briefing…
                </p>
              </Card>
            )}

            {prepError && (
              <Card className="flex items-start gap-2 border-copper bg-clay-light">
                <AlertCircle size={16} className="mt-0.5 text-copper" />
                <p className="text-sm text-brown">{prepError}</p>
              </Card>
            )}

            {prepResult && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={saveToKnowledgeBase}
                    className={saving ? "opacity-50" : ""}
                  >
                    {saved ? <Check size={15} /> : <BookmarkPlus size={15} />}
                    {saving ? "Saving…" : saved ? "Saved to Knowledge Base" : "Save to Knowledge Base"}
                  </Button>
                </div>

                <Card className="bg-brown text-cream">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-clay" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
                      Client Overview
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-cream/90">{prepResult.clientSummary}</p>
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <PrepBlock label="Research Findings" items={prepResult.researchFindings} icon="🔍" />
                  <PrepBlock label="Strengths" items={prepResult.strengths} icon="✓" tone="positive" />
                  <PrepBlock label="Pain Points" items={prepResult.painPoints} icon="!" tone="danger" />
                  <PrepBlock label="Red Flags" items={prepResult.redFlags} icon="⚠" tone="warning" />
                </div>

                <Card>
                  <Eyebrow>Scoping Questions for the Call</Eyebrow>
                  <ol className="mt-3 space-y-2">
                    {prepResult.scopingQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm text-brown">
                        <span className="shrink-0 font-semibold text-clay">{i + 1}.</span>
                        {q}
                      </li>
                    ))}
                  </ol>
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <PrepBlock label="Recommended Services" items={prepResult.recommendedServices} icon="→" tone="clay" />
                  <PrepBlock label="Talking Points" items={prepResult.talkingPoints} icon="›" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Opportunity Scanner Section */}
      <div>
        <button
          onClick={() => setShowOpps((s) => !s)}
          className="mb-4 flex w-full items-center justify-between rounded-xl border border-sand bg-cream px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Target size={16} className="text-clay" />
            <Eyebrow>Pipeline Signals</Eyebrow>
            {opps.length > 0 && (
              <span className="rounded-full bg-clay-light px-2 py-0.5 text-[10px] font-bold text-copper">
                {opps.length}
              </span>
            )}
          </div>
          {showOpps ? <ChevronUp size={16} className="text-brown-mid" /> : <ChevronDown size={16} className="text-brown-mid" />}
        </button>

        {showOpps && (
          <>
            <div className="mb-4 flex justify-end">
              <Button variant="secondary" onClick={() => !busy && scan()}>
                <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                {busy ? "Scanning…" : "Scan now"}
              </Button>
            </div>

            {error && (
              <Card className="mb-4 flex items-start gap-2 border-copper bg-clay-light">
                <AlertCircle size={16} className="mt-0.5 text-copper" />
                <p className="text-sm text-brown">{error}</p>
              </Card>
            )}

            {loaded && opps.length === 0 && (
              <Card className="flex flex-col items-center justify-center py-10 text-center">
                <Target size={28} className="text-clay" />
                <p className="mt-3 max-w-md text-sm text-brown-mid">
                  Connect Gmail and sync your meetings first, then scan. Claude pulls the revenue you
                  haven't named yet out of what's already in your inbox and calls.
                </p>
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
          </>
        )}
      </div>
    </div>
  );
}

function PrepBlock({
  label,
  items,
  icon,
  tone,
}: {
  label: string;
  items: string[];
  icon: string;
  tone?: "positive" | "danger" | "warning" | "clay";
}) {
  if (!items.length) return null;
  const colors = {
    positive: "text-positive",
    danger: "text-copper",
    warning: "text-copper",
    clay: "text-clay",
  };
  const iconColor = tone ? colors[tone] : "text-clay";
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-brown">
            <span className={`shrink-0 ${iconColor}`}>{icon}</span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
