import { useEffect, useState } from "react";
import { Sparkles, Repeat, Calendar, ArrowRight, AlertCircle, Copy, CheckCircle2, SkipForward } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { calendar } from "../data/mock";
import { callApi } from "../lib/api";

type Idea = { pillar: string; format: string; hook: string; source: string };
type Repurpose = { to: string; content: string };

export default function Content() {
  const [tab, setTab] = useState<"ideas" | "draft" | "calendar">("ideas");

  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [ideasGrounded, setIdeasGrounded] = useState(true);
  const [ideasState, setIdeasState] = useState<"loading" | "ready" | "error">("loading");
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [focus, setFocus] = useState("");
  const [currentIdeaIndex, setCurrentIdeaIndex] = useState(0);

  const [selected, setSelected] = useState<Idea | null>(null);
  const [draft, setDraft] = useState("");
  const [repurpose, setRepurpose] = useState<Repurpose[]>([]);
  const [draftState, setDraftState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);

  const [calendarData, setCalendarData] = useState(
    calendar.map((d) => ({ ...d, items: (d.items || []).map((i) => ({ id: Math.random().toString(), t: i.t })) }))
  );
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  async function loadIdeas() {
    setIdeasState("loading");
    setIdeasError(null);
    setCurrentIdeaIndex(0);
    try {
      const r = await callApi<{ ideas: Idea[]; grounded: boolean }>("generateContent", { focus });
      setIdeas(r.ideas ?? []);
      setIdeasGrounded(r.grounded);
      setIdeasState("ready");
    } catch (e: any) {
      setIdeasError(e?.message ?? "Couldn't generate ideas.");
      setIdeasState("error");
    }
  }

  useEffect(() => {
    loadIdeas();
  }, []);

  async function draftIt(idea: Idea) {
    setSelected(idea);
    setTab("draft");
    setDraftState("loading");
    setDraftError(null);
    try {
      const r = await callApi<{ draft: string; repurpose: Repurpose[] }>("draftContent", {
        hook: idea.hook,
        pillar: idea.pillar,
        format: idea.format,
      });
      setDraft(r.draft ?? "");
      setRepurpose(r.repurpose ?? []);
      setDraftState("ready");
    } catch (e: any) {
      setDraftError(e?.message ?? "Couldn't draft this.");
      setDraftState("error");
    }
  }

  async function regenerateCurrentIdea() {
    if (!ideas || currentIdeaIndex >= ideas.length) return;
    const idea = ideas[currentIdeaIndex];
    try {
      const r = await callApi<{ ideas: Idea[] }>("generateContent", { focus });
      if (r.ideas && r.ideas.length > 0) {
        setIdeas(ideas.map((_, i) => (i === currentIdeaIndex ? r.ideas[0] : _)));
      }
    } catch (e: any) {
      setIdeasError(e?.message ?? "Couldn't generate new idea.");
    }
  }

  function addCalendarItem(day: string) {
    if (!newItemText.trim()) return;
    setCalendarData(
      calendarData.map((d) =>
        d.day === day
          ? { ...d, items: [...d.items, { id: Date.now().toString(), t: newItemText.trim() }] }
          : d
      )
    );
    setNewItemText("");
    setEditingDay(null);
  }

  function removeCalendarItem(day: string, itemId: string) {
    setCalendarData(
      calendarData.map((d) =>
        d.day === day ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d
      )
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Content Studio"
        sub="AI-generated ideas, manually drafted content, and your weekly calendar."
        right={
          <Button onClick={() => ideasState !== "loading" && loadIdeas()}>
            <Sparkles size={15} /> {ideasState === "loading" ? "Generating…" : "Generate ideas"}
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
            {t === "ideas" ? "Content Ideas" : t === "draft" ? "Draft + Repurpose" : "Calendar"}
          </button>
        ))}
      </div>

      {tab === "ideas" && (
        <>
          <div className="mb-5 flex gap-2">
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ideasState !== "loading" && loadIdeas()}
              placeholder="What's on your mind? (e.g. onboarding, pricing)"
              className="flex-1 rounded-xl border border-sand bg-cream px-4 py-2.5 text-sm text-brown outline-none placeholder:text-brown-mid/50 focus:border-clay"
            />
            <Button variant="secondary" onClick={() => ideasState !== "loading" && loadIdeas()}>
              <Sparkles size={15} /> Generate
            </Button>
          </div>

          {ideasState === "loading" && (
            <Card className="py-12 text-center text-sm text-brown-mid">
              Generating content ideas…
            </Card>
          )}
          {ideasState === "error" && (
            <Card className="flex items-start gap-2 border-copper bg-clay-light">
              <AlertCircle size={16} className="mt-0.5 text-copper" />
              <p className="text-sm text-brown">{ideasError}</p>
            </Card>
          )}
          {ideasState === "ready" && !ideasGrounded && (
            <Card className="py-12 text-center text-sm text-brown-mid">
              Connect Gmail and sync meetings first for ideas from your real conversations.
            </Card>
          )}
          {ideasState === "ready" && ideasGrounded && ideas && ideas.length > 0 && currentIdeaIndex < ideas.length && (
            <Card className="max-w-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone="clay">{ideas[currentIdeaIndex].pillar}</Badge>
                  <span className="text-[11px] text-brown-mid">{ideas[currentIdeaIndex].format}</span>
                </div>
                <span className="text-xs text-brown-mid">{currentIdeaIndex + 1} of {ideas.length}</span>
              </div>
              <p className="mt-4 font-display text-xl font-semibold leading-snug text-brown">
                "{ideas[currentIdeaIndex].hook}"
              </p>
              {ideas[currentIdeaIndex].source && (
                <p className="mt-2 text-xs italic text-clay">From {ideas[currentIdeaIndex].source}</p>
              )}
              <div className="mt-6 flex gap-2">
                <Button onClick={() => draftIt(ideas[currentIdeaIndex])}>
                  <CheckCircle2 size={16} /> Save & Draft
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => regenerateCurrentIdea()}
                >
                  <SkipForward size={16} /> Skip
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "draft" && (
        <>
          {draftState === "idle" && (
            <Card className="py-12 text-center text-sm text-brown-mid">
              Pick an idea on Content Suggestions and hit "Draft it" to write a post here.
            </Card>
          )}
          {draftState === "loading" && (
            <Card className="py-12 text-center text-sm text-brown-mid">
              Writing your post in your voice…
            </Card>
          )}
          {draftState === "error" && (
            <Card className="flex items-start gap-2 border-copper bg-clay-light">
              <AlertCircle size={16} className="mt-0.5 text-copper" />
              <p className="text-sm text-brown">{draftError}</p>
            </Card>
          )}
          {draftState === "ready" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="clay">{selected?.format ?? "Post"}</Badge>
                    {selected && <Badge>{selected.pillar}</Badge>}
                  </div>
                  <span className="text-[11px] text-brown-mid">
                    {draft.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-[420px] w-full resize-none rounded-xl border border-sand bg-light p-4 text-sm leading-relaxed text-brown outline-none focus:border-clay"
                />
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => navigator.clipboard?.writeText(draft)}>
                    <Copy size={14} /> Copy
                  </Button>
                  <Button variant="secondary" onClick={() => selected && draftIt(selected)}>
                    <Sparkles size={14} /> Rewrite
                  </Button>
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <div className="mb-2 flex items-center gap-2">
                  <Repeat size={16} className="text-clay" />
                  <Eyebrow>AI Repurposing</Eyebrow>
                </div>
                <p className="mb-4 text-sm text-brown-mid">One post, your whole week.</p>
                <div className="space-y-2">
                  {repurpose.length === 0 && (
                    <p className="text-sm italic text-brown-mid/60">No variants returned.</p>
                  )}
                  {repurpose.map((r) => (
                    <div key={r.to} className="rounded-lg border border-sand bg-light px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-brown">{r.to}</p>
                        <button
                          onClick={() => navigator.clipboard?.writeText(r.content)}
                          className="text-brown-mid hover:text-clay"
                          title="Copy"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-snug text-brown-mid">
                        {r.content}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {tab === "calendar" && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-clay" />
            <Eyebrow>This Week</Eyebrow>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {calendarData.map((d) => (
              <div key={d.day} className="rounded-xl border border-sand bg-light p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-mid">{d.day}</p>
                  <p className="text-[11px] font-semibold text-clay">{d.date}</p>
                </div>
                <div className="space-y-2">
                  {d.items.length === 0 && editingDay !== d.day && (
                    <button
                      onClick={() => setEditingDay(d.day)}
                      className="text-[11px] italic text-brown-mid/50 hover:text-clay"
                    >
                      + Add item
                    </button>
                  )}
                  {d.items.map((it) => (
                    <div key={it.id} className="group flex items-center justify-between rounded-lg bg-cream px-2 py-1.5">
                      <p className="text-[11px] font-medium text-brown">{it.t}</p>
                      <button
                        onClick={() => removeCalendarItem(d.day, it.id)}
                        className="text-brown-mid/0 transition group-hover:text-brown-mid"
                      >
                        <SkipForward size={12} />
                      </button>
                    </div>
                  ))}
                  {editingDay === d.day && (
                    <div className="space-y-1">
                      <input
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCalendarItem(d.day)}
                        placeholder="Post idea…"
                        className="w-full rounded-lg border border-clay bg-white px-2 py-1 text-[11px] text-brown outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => addCalendarItem(d.day)}
                          className="flex-1 rounded-lg bg-clay px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-copper"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setEditingDay(null);
                            setNewItemText("");
                          }}
                          className="flex-1 rounded-lg bg-sand px-2 py-0.5 text-[10px] font-semibold text-brown hover:bg-sand/80"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
