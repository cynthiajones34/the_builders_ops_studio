import { useEffect, useState } from "react";
import { Sparkles, Repeat, Calendar, ArrowRight, AlertCircle, Copy, Plus, X, Pencil } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { calendar } from "../data/mock";
import { callApi } from "../lib/api";

type Idea = { id: string; pillar: string; format: string; hook: string; source: string };
type Repurpose = { to: string; content: string };
type CalendarDay = { day: string; date: string; items: { id: string; t: string }[] };

const PILLARS = ["Operations", "Pricing", "Culture", "Growth"];
const FORMATS = ["LinkedIn Post", "Email", "Twitter", "Blog"];

export default function Content() {
  const [tab, setTab] = useState<"ideas" | "draft" | "calendar">("ideas");

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<Idea | null>(null);
  const [draft, setDraft] = useState("");
  const [repurpose, setRepurpose] = useState<Repurpose[]>([]);
  const [draftState, setDraftState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const [calendarData, setCalendarData] = useState<CalendarDay[]>(
    calendar.map((d) => ({ ...d, items: (d.items || []).map((i) => ({ id: Math.random().toString(), t: i.t })) }))
  );
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const [newIdea, setNewIdea] = useState<Idea>({ id: "", pillar: "Operations", format: "LinkedIn Post", hook: "", source: "" });
  const [showNewForm, setShowNewForm] = useState(false);

  function addIdea() {
    if (!newIdea.hook.trim()) return;
    const idea = { ...newIdea, id: Date.now().toString() };
    setIdeas([...ideas, idea]);
    setNewIdea({ id: "", pillar: "Operations", format: "LinkedIn Post", hook: "", source: "" });
    setShowNewForm(false);
  }

  function removeIdea(id: string) {
    setIdeas(ideas.filter((i) => i.id !== id));
    if (selected?.id === id) setSelected(null);
  }

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

  async function regenerateIdea(idea: Idea) {
    setRegeneratingId(idea.id);
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
      setDraftError(e?.message ?? "Couldn't regenerate.");
    } finally {
      setRegeneratingId(null);
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
        sub="Plan your content, draft your posts, and manage your calendar."
        right={
          <Button onClick={() => setShowNewForm(!showNewForm)}>
            <Plus size={15} /> {showNewForm ? "Cancel" : "Add idea"}
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
        <>
          {showNewForm && (
            <Card className="mb-6">
              <Eyebrow>Add Content Idea</Eyebrow>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select
                    value={newIdea.pillar}
                    onChange={(e) => setNewIdea({ ...newIdea, pillar: e.target.value })}
                    className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
                  >
                    {PILLARS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newIdea.format}
                    onChange={(e) => setNewIdea({ ...newIdea, format: e.target.value })}
                    className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={newIdea.hook}
                  onChange={(e) => setNewIdea({ ...newIdea, hook: e.target.value })}
                  placeholder="Content idea (the hook or main point)"
                  className="w-full rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
                />
                <input
                  value={newIdea.source}
                  onChange={(e) => setNewIdea({ ...newIdea, source: e.target.value })}
                  placeholder="Source (optional - e.g. client call, email)"
                  className="w-full rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
                />
                <div className="flex gap-2">
                  <Button onClick={addIdea} className={!newIdea.hook.trim() ? "opacity-50" : ""}>
                    <Plus size={14} /> Add Idea
                  </Button>
                  <Button variant="ghost" onClick={() => setShowNewForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {ideas.length === 0 && !showNewForm && (
            <Card className="py-12 text-center text-sm text-brown-mid">
              No content ideas yet. Click "Add idea" to suggest content topics.
            </Card>
          )}

          {ideas.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ideas.map((idea) => (
                <Card key={idea.id} className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone="clay">{idea.pillar}</Badge>
                      <span className="text-[11px] text-brown-mid">{idea.format}</span>
                    </div>
                    <button onClick={() => removeIdea(idea.id)} className="text-brown-mid hover:text-copper">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mt-3 font-display text-lg font-semibold leading-snug text-brown">
                    "{idea.hook}"
                  </p>
                  {idea.source && <p className="mt-2 text-xs italic text-clay">From {idea.source}</p>}
                  <div className="mt-auto flex gap-2 pt-4">
                    <Button
                      variant="secondary"
                      className="flex-1 !py-1.5 text-xs"
                      onClick={() => draftIt(idea)}
                    >
                      Draft it <ArrowRight size={13} />
                    </Button>
                    {selected?.id === idea.id && draftState === "ready" && (
                      <Button
                        variant="secondary"
                        className="!py-1.5 text-xs"
                        onClick={() => regenerateIdea(idea)}
                      >
                        <Sparkles size={12} /> {regeneratingId === idea.id ? "..." : "Regen"}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
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
                        <X size={12} />
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
