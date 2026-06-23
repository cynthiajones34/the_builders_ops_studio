import { Sparkles } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { contacts, recommendations } from "../data/mock";

const warmthTone: Record<string, any> = {
  hot: "danger",
  warm: "clay",
  cooling: "warning",
  active: "positive",
};

export default function Crm() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="CRM & Relationships"
        sub="Contacts, clients, prospects, partners, and media. Every email, meeting, and note in one history."
        right={<Button>Add contact</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="!p-0">
            <div className="grid grid-cols-12 border-b border-sand px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-brown-mid">
              <span className="col-span-4">Contact</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2">Last touch</span>
              <span className="col-span-4">AI note</span>
            </div>
            <div className="divide-y divide-sand">
              {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-light">
                  <div className="col-span-4">
                    <p className="text-sm font-semibold text-brown">{c.name}</p>
                    <p className="text-xs text-brown-mid">{c.org}</p>
                  </div>
                  <div className="col-span-2">
                    <Badge>{c.type}</Badge>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{
                      background: c.warmth === "hot" ? "#A0522D" : c.warmth === "cooling" ? "#B8860B" : c.warmth === "active" ? "#4F7A4F" : "#C4956A",
                    }} />
                    <span className="text-xs text-brown-mid">{c.last}</span>
                  </div>
                  <p className="col-span-4 text-xs text-brown-mid">{c.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="bg-brown text-cream">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-clay" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
              Relationship Recommendations
            </p>
          </div>
          <div className="space-y-3">
            {recommendations.map((r, i) => (
              <div key={i} className="rounded-xl bg-white/5 p-3">
                <p className="text-sm leading-snug text-cream/90">{r.text}</p>
                <Button variant="accent" className="mt-2 !py-1 text-xs">
                  {r.action}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
