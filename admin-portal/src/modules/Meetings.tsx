import { Video, CheckSquare, Lightbulb, Flag } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { meetings } from "../data/mock";

export default function Meetings() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Meeting Intelligence"
        sub="Zoom and Google Meet, recorded and read for you. Every meeting becomes action items, decisions, and opportunities."
        right={
          <Button variant="secondary">
            <Video size={15} /> Connect Zoom / Meet
          </Button>
        }
      />

      <div className="space-y-5">
        {meetings.map((m, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-brown">{m.title}</h2>
                  <Badge tone={m.status === "upcoming" ? "clay" : "positive"}>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-xs text-brown-mid">{m.when}</p>
              </div>
              {m.status === "upcoming" ? (
                <Button variant="secondary">Prep with AI</Button>
              ) : (
                <Button variant="ghost">View transcript</Button>
              )}
            </div>

            <p className="mt-3 text-sm italic text-brown-mid">{m.summary}</p>

            {m.status !== "upcoming" && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <ExtractBlock icon={CheckSquare} label="Action Items" items={m.actions} />
                <ExtractBlock icon={Flag} label="Decisions" items={m.decisions ?? []} />
                <ExtractBlock
                  icon={Lightbulb}
                  label="Opportunities"
                  items={m.opportunities ?? []}
                  accent
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExtractBlock({
  icon: Icon,
  label,
  items,
  accent,
}: {
  icon: any;
  label: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-clay bg-clay-light/40" : "border-sand bg-light"}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={14} className="text-clay" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid">{label}</p>
      </div>
      <ul className="space-y-1.5">
        {items.length === 0 && <li className="text-xs italic text-brown-mid/50">None</li>}
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5 text-sm leading-snug text-brown">
            <span className="text-clay">·</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
