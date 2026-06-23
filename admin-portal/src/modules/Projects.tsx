import { Sparkles, ArrowRight } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { projects } from "../data/mock";

const healthTone: Record<string, any> = { good: "positive", watch: "warning", risk: "danger" };

export default function Projects() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Projects"
        sub="Every meeting updates the right project automatically. Ask the assistant for status, what's overdue, or next steps."
        right={<Button>New project</Button>}
      />

      <Card className="mb-6 bg-brown text-cream">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-clay" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-clay">
            Ask the Project Assistant
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "What's overdue?",
            "Status of Glow Up?",
            "What was discussed last month?",
            "What are the next steps for Bloom?",
          ].map((q) => (
            <button
              key={q}
              className="rounded-full border border-clay/40 px-3 py-1.5 text-sm text-cream/90 hover:bg-white/5"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {projects.map((p, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-clay">{p.client}</p>
                <h2 className="font-display text-lg font-bold leading-snug text-brown">
                  {p.name}
                </h2>
              </div>
              <Badge tone={healthTone[p.health]}>{p.status}</Badge>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-clay"
                style={{ width: `${p.progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-brown-mid">
              <span>{p.progress}% complete</span>
              <span>Due {p.due}</span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-sand pt-3">
              <p className="text-sm text-brown">
                <span className="font-semibold text-clay">Next: </span>
                {p.next}
              </p>
              <ArrowRight size={15} className="text-brown-mid" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
