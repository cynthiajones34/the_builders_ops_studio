import { Target, Sparkles } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { opportunities } from "../data/mock";

export default function Opportunities() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Opportunity Engine"
        sub="Always watching your email, meetings, notes, and social for revenue you haven't named yet."
        right={<Button variant="secondary">Weekly report</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {opportunities.map((o, i) => (
          <Card key={i} className="flex flex-col hover:border-clay">
            <div className="flex items-center justify-between">
              <Badge tone={o.tone as any}>{o.type}</Badge>
              <span className="text-xs font-semibold text-clay">{o.value}</span>
            </div>
            <h2 className="mt-3 font-display text-xl font-bold leading-snug text-brown">
              {o.title}
            </h2>
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-light p-2.5">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-clay" />
              <p className="text-xs text-brown-mid">{o.evidence}</p>
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Button className="!py-1.5 text-xs">Pursue</Button>
              <Button variant="ghost" className="!py-1.5 text-xs">Dismiss</Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 flex items-center gap-3 bg-brown text-cream">
        <Target size={20} className="text-clay" />
        <p className="text-sm text-cream/90">
          This week the engine surfaced <span className="font-bold text-clay">4 opportunities</span> worth an estimated
          <span className="font-bold text-clay"> $15–25K</span> in new pipeline.
        </p>
      </Card>
    </div>
  );
}
