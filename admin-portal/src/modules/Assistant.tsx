import { Sparkles, CheckSquare, Clock, Zap } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { recommendations } from "../data/mock";

const delegation = [
  { task: "Schedule social posts", time: "2.5 hrs/wk", action: "Automate", tone: "positive" },
  { task: "Invoice follow-ups", time: "1 hr/wk", action: "Automate", tone: "positive" },
  { task: "Meeting note cleanup", time: "3 hrs/wk", action: "Automated ✓", tone: "clay" },
  { task: "Inbox triage", time: "4 hrs/wk", action: "Delegate", tone: "warning" },
];

export default function Assistant() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="AI Executive Assistant"
        sub="Your chief of staff, watching everything and surfacing what you'd miss. Use 'Ask BOS AI' up top for a conversation."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Eyebrow>Proactive Recommendations</Eyebrow>
          <div className="mt-2 space-y-3">
            {recommendations.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-sand bg-light p-3"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{
                  background: r.tone === "danger" ? "#A0522D" : r.tone === "positive" ? "#4F7A4F" : "#C4956A",
                }} />
                <p className="flex-1 text-sm text-brown">{r.text}</p>
                <Button variant="secondary" className="!py-1.5 text-xs">{r.action}</Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-brown text-cream">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={16} className="text-clay" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-clay">
              Delegation Dashboard
            </p>
          </div>
          <p className="mb-3 text-sm text-cream/80">
            10.5 hrs/week you could give back to strategy.
          </p>
          <div className="space-y-2">
            {delegation.map((d) => (
              <div key={d.task} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-cream">{d.task}</p>
                  <p className="flex items-center gap-1 text-[11px] text-clay">
                    <Clock size={11} /> {d.time}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-clay">{d.action}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
