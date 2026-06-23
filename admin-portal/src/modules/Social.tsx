import { Sparkles } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { socialAccounts, topContent } from "../data/mock";

const insights = [
  { tone: "positive", text: "Mindset content is outperforming everything. Your 'under-systemized' post drove 38% of weekly engagement." },
  { tone: "warning", text: "Pure how-to Operations posts are underperforming. Wrap them in a client story." },
  { tone: "clay", text: "TikTok is your fastest-growing channel (+22%). Founder-story voiceovers are landing." },
  { tone: "clay", text: "Best posting windows: Tue 8am and Fri 12pm. Your audience is most active then." },
];

export default function Social() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Social Command"
        sub="Instagram, TikTok, LinkedIn, and Substack in one view. The numbers, and what they mean."
        right={<Button variant="secondary">Connect accounts</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {socialAccounts.map((a) => (
          <Card key={a.platform}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-brown">{a.platform}</p>
              <Badge tone="positive">{a.growth}</Badge>
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-brown">{a.followers}</p>
            <p className="text-xs text-brown-mid">followers</p>
            <div className="mt-3 flex justify-between border-t border-sand pt-2 text-xs text-brown-mid">
              <span>Engagement {a.engagement}</span>
              <span>Reach {a.reach}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Eyebrow>Top-Performing Content</Eyebrow>
          <div className="mt-2 divide-y divide-sand">
            {topContent.map((c, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <span className="font-display text-2xl font-bold text-clay">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-snug text-brown">{c.title}</p>
                  <p className="text-xs text-brown-mid">{c.metric}</p>
                </div>
                <Badge tone="clay">{c.pillar}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-brown text-cream">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-clay" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
              AI Insights
            </p>
          </div>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <p key={i} className="flex gap-2 text-sm leading-snug text-cream/90">
                <span className="text-clay">›</span>
                {ins.text}
              </p>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
