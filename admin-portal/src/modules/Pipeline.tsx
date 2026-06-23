import { Bot } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { pipeline } from "../data/mock";

const stageTone: Record<string, any> = {
  "New Lead": "neutral",
  Qualified: "clay",
  Proposal: "warning",
  Won: "positive",
};

export default function Pipeline() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="BD Pipeline"
        sub="Your deals from first touch to won. New leads flow in from the BOS SDR agent automatically."
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
            Sourced 5 leads this week. 2 qualified, 1 booked a call. Last run 2h ago.
          </p>
        </div>
        <Button variant="ghost">View agent</Button>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {pipeline.map((col) => {
          const total = col.deals.length;
          return (
            <div key={col.stage}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{
                    background: col.stage === "Won" ? "#4F7A4F" : col.stage === "Proposal" ? "#B8860B" : col.stage === "Qualified" ? "#C4956A" : "#E8DCC8",
                  }} />
                  <p className="text-sm font-bold text-brown">{col.stage}</p>
                </div>
                <span className="text-xs text-brown-mid">{total}</span>
              </div>
              <div className="space-y-3">
                {col.deals.map((d, i) => (
                  <Card key={i} className="!p-3">
                    <p className="text-sm font-semibold text-brown">{d.name}</p>
                    <p className="mt-1 font-display text-lg font-bold text-clay">{d.value}</p>
                    <Badge tone={stageTone[col.stage]}>{d.from}</Badge>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
