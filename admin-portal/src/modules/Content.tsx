import { useState } from "react";
import { Sparkles, Repeat, Calendar, ArrowRight } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { contentIdeas, calendar } from "../data/mock";

const draft = `She already knows her business is going to work.

That belief is real. It's what got her here.

But belief alone doesn't build systems.

You're not disorganized. You're under-systemized.

I had a client turning away work because she couldn't keep up with onboarding. What she needed wasn't more hustle. She needed a system that ran without her.

We documented one onboarding flow. Three new clients the following month, and she never touched the intake herself.

What closes the gap is structure.

#blackwomenentrepreneurs #smallbusinessoperations #buildersopsstudio`;

const repurpose = [
  { to: "Instagram carousel", note: "6 slides, hook on slide 1" },
  { to: "TikTok script", note: "45-sec voiceover, single insight" },
  { to: "Substack article", note: "Expand the client story into 600 words" },
  { to: "Email newsletter", note: "Short reflection + one takeaway" },
];

export default function Content() {
  const [tab, setTab] = useState<"ideas" | "draft" | "calendar">("ideas");

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Content Studio"
        sub="Your personal content strategist. Ideas pulled from your meetings, emails, and what's already resonating."
        right={
          <Button>
            <Sparkles size={15} /> Generate from this week
          </Button>
        }
      />

      <div className="mb-5 flex gap-1 rounded-xl border border-sand bg-cream p-1">
        {(["ideas", "draft", "calendar"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-brown text-cream" : "text-brown-mid hover:bg-clay-light"
            }`}
          >
            {t === "ideas" ? "Content Suggestions" : t === "draft" ? "Draft + Repurpose" : "Content Calendar"}
          </button>
        ))}
      </div>

      {tab === "ideas" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {contentIdeas.map((idea, i) => (
            <Card key={i} className="flex flex-col">
              <div className="flex items-center justify-between">
                <Badge tone="clay">{idea.pillar}</Badge>
                <span className="text-[11px] text-brown-mid">{idea.format}</span>
              </div>
              <p className="mt-3 font-display text-lg font-semibold leading-snug text-brown">
                "{idea.hook}"
              </p>
              <p className="mt-2 text-xs italic text-clay">{idea.source}</p>
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="secondary" className="!py-1.5 text-xs">
                  Draft it <ArrowRight size={13} />
                </Button>
                <Button variant="ghost" className="!py-1.5 text-xs">
                  Save idea
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "draft" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="clay">LinkedIn</Badge>
                <Badge>Molly Graham framework</Badge>
              </div>
              <span className="text-[11px] text-positive">198 words • on-brand ✓</span>
            </div>
            <textarea
              defaultValue={draft}
              className="h-[420px] w-full resize-none rounded-xl border border-sand bg-light p-4 text-sm leading-relaxed text-brown outline-none focus:border-clay"
            />
            <div className="mt-3 flex gap-2">
              <Button>Approve + schedule</Button>
              <Button variant="secondary">
                <Sparkles size={14} /> Rewrite
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="mb-2 flex items-center gap-2">
              <Repeat size={16} className="text-clay" />
              <Eyebrow>AI Repurposing</Eyebrow>
            </div>
            <p className="mb-4 text-sm text-brown-mid">
              Turn this one post into your whole week.
            </p>
            <div className="space-y-2">
              {repurpose.map((r) => (
                <div
                  key={r.to}
                  className="flex items-center justify-between rounded-lg border border-sand bg-light px-3 py-2.5 hover:border-clay"
                >
                  <div>
                    <p className="text-sm font-semibold text-brown">{r.to}</p>
                    <p className="text-[11px] text-brown-mid">{r.note}</p>
                  </div>
                  <Button variant="ghost" className="!px-2 !py-1 text-xs">
                    Generate
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "calendar" && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-clay" />
            <Eyebrow>This Week</Eyebrow>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {calendar.map((d) => (
              <div key={d.day} className="rounded-xl border border-sand bg-light p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-mid">
                    {d.day}
                  </p>
                  <p className="text-[11px] font-semibold text-clay">{d.date}</p>
                </div>
                <div className="space-y-2">
                  {d.items.length === 0 && (
                    <p className="text-[11px] italic text-brown-mid/50">Open slot</p>
                  )}
                  {d.items.map((it, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-cream px-2 py-1.5 text-[11px] font-medium text-brown"
                    >
                      {it.t}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
