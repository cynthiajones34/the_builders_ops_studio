import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Stat, Button } from "../components/ui";
import { healthMetrics, revenueTrend } from "../data/mock";
import { callApi } from "../lib/api";

type Briefing = {
  priorities: string[];
  actions: string[];
  followups: string[];
  opportunities: string[];
  risks: string[];
  grounded?: boolean;
};

const todayLabel = new Date().toLocaleDateString([], {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default function Dashboard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingState, setBriefingState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    callApi<Briefing>("dailyBriefing")
      .then((b) => {
        if (!active) return;
        setBriefing(b);
        setBriefingState("ready");
      })
      .catch(() => active && setBriefingState("error"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Good morning, Cynthia."
        sub="Here's what matters today. Everything else can wait."
        right={
          <Button variant="secondary">
            {todayLabel} <ArrowRight size={15} />
          </Button>
        }
      />

      {/* Health metrics (sample until revenue/CRM are connected) */}
      <div className="mb-1 flex items-center gap-2">
        <Eyebrow>Business Health</Eyebrow>
        <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brown-mid">
          Sample
        </span>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {healthMetrics.map((m) => (
          <Stat key={m.label} label={m.label} value={m.value} delta={m.delta} tone={m.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's priorities (real, from the AI briefing) */}
        <Card className="lg:col-span-2">
          <Eyebrow>Today's Priorities</Eyebrow>
          <div className="mt-2">
            {briefingState === "loading" && (
              <p className="py-3 text-sm text-brown-mid">Pulling today's priorities from your inbox…</p>
            )}
            {briefingState === "error" && (
              <p className="py-3 text-sm text-brown-mid">Couldn't load priorities. Refresh in a moment.</p>
            )}
            {briefingState === "ready" && (briefing?.priorities?.length ?? 0) === 0 && (
              <p className="py-3 text-sm text-brown-mid">
                Connect Gmail and sync meetings, and your priorities surface here automatically.
              </p>
            )}
            <div className="divide-y divide-sand">
              {briefing?.priorities?.map((p, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
                  <p className="flex-1 text-sm font-medium text-brown">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* AI Daily Briefing */}
        <Card className="bg-brown text-cream">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-clay" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
              AI Daily Briefing
            </p>
          </div>

          {briefingState === "loading" && (
            <p className="text-sm text-cream/70">Reading your inbox and writing today's briefing…</p>
          )}
          {briefingState === "error" && (
            <p className="text-sm text-cream/80">
              The briefing couldn't load just now. Refresh in a moment.
            </p>
          )}
          {briefingState === "ready" && briefing && briefing.grounded === false && (
            <p className="text-sm leading-snug text-cream/90">
              Connect Gmail on the Email Intelligence page and your morning briefing will run on
              your real inbox.
            </p>
          )}
          {briefingState === "ready" && briefing && briefing.grounded !== false && (
            <>
              <BriefBlock label="Top priorities" items={briefing.priorities} />
              <BriefBlock label="Recommended actions" items={briefing.actions} />
              <BriefBlock label="Follow-ups needed" items={briefing.followups} />
              <BriefBlock label="Opportunities" items={briefing.opportunities} />
              <BriefBlock label="Risks / overdue" items={briefing.risks} danger />
            </>
          )}
        </Card>
      </div>

      {/* Revenue pipeline trend */}
      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Eyebrow>Revenue Trend</Eyebrow>
              <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brown-mid">
                Sample
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-brown">
              Revenue pipeline vs. closed
            </h2>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="pipe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C4956A" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#C4956A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="closed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3D2B1F" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3D2B1F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E8DCC8" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#6B4C3B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B4C3B", fontSize: 12 }} axisLine={false} tickLine={false} unit="K" />
              <Tooltip
                contentStyle={{
                  background: "#3D2B1F",
                  border: "none",
                  borderRadius: 12,
                  color: "#F5F0E8",
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="pipeline" stroke="#C4956A" strokeWidth={2} fill="url(#pipe)" />
              <Area type="monotone" dataKey="closed" stroke="#3D2B1F" strokeWidth={2} fill="url(#closed)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function BriefBlock({
  label,
  items,
  danger,
}: {
  label: string;
  items: string[];
  danger?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <p className={`text-xs font-bold ${danger ? "text-clay" : "text-clay/90"}`}>{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-cream/90">
            <span className="text-clay">›</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
