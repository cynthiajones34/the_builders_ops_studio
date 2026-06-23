import { useState } from "react";
import { FileBarChart, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";

const reports = {
  Daily: {
    blurb: "Tuesday, June 23",
    blocks: [
      { label: "Priorities", items: ["Close loop with Maya", "Ship Glow Up SOP", "Approve LinkedIn post"] },
      { label: "Opportunities", items: ["AI workshop demand building", "Speaking invite from Atlanta Founders"] },
      { label: "Tasks", items: ["9 open, 2 overdue", "Invoice #1043 past due"] },
    ],
  },
  Weekly: {
    blurb: "Week of June 16–22",
    blocks: [
      { label: "Wins", items: ["Closed Glow Up onboarding ($5K)", "TikTok up 22%", "Best LinkedIn post of the quarter"] },
      { label: "Pipeline", items: ["+$12K added (Sankofa proposal)", "5 SDR leads, 2 qualified"] },
      { label: "Content", items: ["Mindset pillar driving 38% of engagement", "3 posts shipped, 1 newsletter"] },
      { label: "Revenue ops", items: ["AI workshop offer worth building", "Glow Up retainer upsell open"] },
    ],
  },
  Monthly: {
    blurb: "June 2026",
    blocks: [
      { label: "Trends", items: ["Pipeline up 12% MoM, 6 months straight", "Wellness niche emerging as best-fit ICP"] },
      { label: "Growth", items: ["Followers +183% YoY", "Engagement +0.6 pts", "Email list +14%"] },
      { label: "Strategy", items: ["Productize 'Onboarding System in a Week'", "Lean into client-story content", "Raise retainer floor. Demand supports it"] },
    ],
  },
};

const extras = [
  { icon: AlertTriangle, title: "Client Health", note: "Sankofa at risk: proposal idle 6 days. All others healthy.", tone: "warning" },
  { icon: TrendingUp, title: "Revenue Forecast", note: "Projected $62K next 90 days from pipeline + renewals (78% confidence).", tone: "positive" },
  { icon: Sparkles, title: "AI Offer Generator", note: "Recurring pain: onboarding chaos. Suggested offer: 'Onboarding System in a Week.'", tone: "clay" },
];

export default function Reports() {
  const [tab, setTab] = useState<keyof typeof reports>("Weekly");
  const r = reports[tab];

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Intelligence Reports"
        sub="Your business, summarized. Daily priorities, weekly momentum, monthly strategy."
        right={
          <Button variant="secondary">
            <FileBarChart size={15} /> Export
          </Button>
        }
      />

      <div className="mb-5 flex gap-1 rounded-xl border border-sand bg-cream p-1">
        {(Object.keys(reports) as (keyof typeof reports)[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t ? "bg-brown text-cream" : "text-brown-mid hover:bg-clay-light"
            }`}
          >
            {t} Report
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <Eyebrow>{tab} Report · {r.blurb}</Eyebrow>
        <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {r.blocks.map((b) => (
            <div key={b.label}>
              <p className="mb-2 text-sm font-bold text-clay">{b.label}</p>
              <ul className="space-y-1.5">
                {b.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug text-brown">
                    <span className="text-clay">›</span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {extras.map((e) => (
          <Card key={e.title}>
            <div className="mb-2 flex items-center gap-2">
              <e.icon size={16} className="text-clay" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid">
                {e.title}
              </p>
            </div>
            <p className="text-sm leading-snug text-brown">{e.note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
