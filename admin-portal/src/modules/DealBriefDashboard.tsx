import { useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  stage?: string;
  proposalStatus?: string;
  proposalSentDate?: string;
  lastContactDate?: string;
  dealValue?: number | string;
  meetingSource?: string;
  needsFollowup?: boolean;
  urgent?: boolean;
};

const name = (l: Lead) => `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || "Unnamed lead";
const daysSince = (iso?: string) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null;

type EventItem = {
  name: string;
  date?: string;
  type?: string;
  location?: string;
  url?: string;
  why?: string;
};

export default function DealBriefDashboard() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "contacts"), (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) })));
      setLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid, "state", "events"), (snap) => {
      const data = snap.data() as { events?: EventItem[] } | undefined;
      setEvents(Array.isArray(data?.events) ? data!.events : []);
    });
  }, [user]);

  const { pending, awaiting, followups, discovery } = useMemo(() => {
    const pending = leads
      .filter((l) => l.proposalStatus === "pending")
      .sort((a, b) => (a.proposalSentDate ?? "").localeCompare(b.proposalSentDate ?? ""));
    const awaiting = leads.filter((l) => l.proposalStatus === "awaiting_response");
    const followups = leads.filter((l) => l.needsFollowup);
    const discovery = leads.filter((l) => l.stage === "discovery");
    return { pending, awaiting, followups, discovery };
  }, [leads]);

  async function markContacted(id: string) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "contacts", id), {
      lastContactDate: new Date().toISOString(),
      needsFollowup: false,
    });
  }

  const Row = ({ lead, meta }: { lead: Lead; meta: string }) => (
    <div className="flex items-center gap-3 border-t border-sand py-3 first:border-t-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-brown">{name(lead)}</p>
        <p className="text-xs text-brown-mid">{meta}</p>
      </div>
      {lead.dealValue ? <Badge tone="clay">${lead.dealValue}</Badge> : null}
      <Button variant="secondary" className="text-xs" onClick={() => markContacted(lead.id)}>
        Mark contacted
      </Button>
    </div>
  );

  const Section = ({
    eyebrow,
    empty,
    children,
  }: {
    eyebrow: string;
    empty: string;
    children: ReactNode;
  }) => (
    <Card className="mb-4">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-2">{children || <p className="py-3 text-sm text-brown-mid">{empty}</p>}</div>
    </Card>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle
        title="Deal Brief"
        sub="Today's deal-closing actions, ranked by urgency. This is the full view behind your morning text."
      />

      {!loaded && (
        <Card className="py-12 text-center text-sm text-brown-mid">Loading your pipeline…</Card>
      )}

      {loaded && (
        <>
          <Section
            eyebrow={`Proposals Pending (${pending.length})`}
            empty="No proposals waiting to go out."
          >
            {pending.map((l) => (
              <Row
                key={l.id}
                lead={l}
                meta={`${daysSince(l.proposalSentDate) ?? "?"}d since sent · last contact ${
                  daysSince(l.lastContactDate) ?? "?"
                }d ago`}
              />
            ))}
          </Section>

          <Section
            eyebrow={`Awaiting Response — Urgent (${awaiting.length})`}
            empty="Nothing overdue for a reply."
          >
            {awaiting.map((l) => (
              <Row key={l.id} lead={l} meta={`${daysSince(l.proposalSentDate) ?? "?"}d with no reply`} />
            ))}
          </Section>

          <Section
            eyebrow={`Follow-up Needed (${followups.length})`}
            empty="Everyone's been contacted recently."
          >
            {followups.map((l) => (
              <Row
                key={l.id}
                lead={l}
                meta={`${daysSince(l.lastContactDate) ?? "?"}d since contact${
                  l.meetingSource ? ` · from ${l.meetingSource}` : ""
                }`}
              />
            ))}
          </Section>

          <Section eyebrow={`Discovery Stage (${discovery.length})`} empty="No leads in discovery.">
            {discovery.map((l) => (
              <Row key={l.id} lead={l} meta={`last contact ${daysSince(l.lastContactDate) ?? "?"}d ago`} />
            ))}
          </Section>

          <Section
            eyebrow={`Events to Consider (${events.length})`}
            empty="No events pulled yet. Refreshes Mondays."
          >
            {events.map((e, i) => (
              <div key={i} className="border-t border-sand py-3 first:border-t-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-brown underline underline-offset-2 hover:text-copper"
                      >
                        {e.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-brown">{e.name}</p>
                    )}
                    <p className="text-xs text-brown-mid">
                      {[e.date, e.location, e.why].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {e.type ? <Badge tone="clay">{e.type}</Badge> : null}
                </div>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
