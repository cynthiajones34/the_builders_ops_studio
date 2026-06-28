import { useEffect, useMemo, useRef, useState } from "react";
import { Search, FileText, Plus, X, ExternalLink, Trash2, ArrowLeft, Pencil } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type Resource = {
  id: string;
  title: string;
  url?: string;
  notes?: string;
  type?: string;
  topic?: string;
  addedAt?: number;
};

const TYPES = ["Link", "SOP", "Template", "Reference", "Notes"];

function TopicEditor({
  id,
  topic,
  onSave,
}: {
  id: string;
  topic?: string;
  onSave: (id: string, t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(topic ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    onSave(id, val.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Type a topic…"
        className="mt-2 w-full rounded-lg border border-clay bg-transparent px-2 py-0.5 text-[11px] text-brown outline-none"
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setVal(topic ?? ""); setEditing(true); }}
      title="Click to set topic"
      className="mt-2 text-[11px] text-brown-mid/50 hover:text-clay"
    >
      {topic ? topic : "+ Add topic"}
    </button>
  );
}

export default function Knowledge() {
  const { user } = useAuth();
  const [items, setItems] = useState<Resource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("Link");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "knowledge"), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Resource, "id">) }));
      setItems(all);
      setLoaded(true);
      setOpenItem((prev) => prev ? all.find((r) => r.id === prev.id) ?? null : null);
    });
  }, [user]);

  async function add() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "knowledge"), {
        title: title.trim(),
        url: url.trim(),
        notes: notes.trim(),
        type,
        topic: topic.trim(),
        addedAt: Date.now(),
      });
      setTitle("");
      setUrl("");
      setNotes("");
      setType("Link");
      setTopic("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "knowledge", id));
  }

  const [openItem, setOpenItem] = useState<Resource | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesVal, setEditNotesVal] = useState("");

  async function updateTopic(id: string, newTopic: string) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "knowledge", id), { topic: newTopic });
  }

  async function updateNotes(id: string, newNotes: string) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "knowledge", id), { notes: newNotes });
    setEditingNotes(false);
  }

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((k) =>
      !q || [k.title, k.notes, k.type, k.topic].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
    const map = new Map<string, Resource[]>();
    for (const item of list) {
      const t = item.topic?.trim() || "General";
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(item);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === "General" && b !== "General") return 1;
        if (b === "General" && a !== "General") return -1;
        return a.localeCompare(b);
      })
      .map(([t, ks]) => ({
        topic: t,
        items: [...ks].sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [items, search]);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Knowledge Base"
        sub="Your SOPs, templates, research, links, and client info, all in one place."
        right={
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Cancel" : "Add resource"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <Eyebrow>New resource</Eyebrow>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (required)"
              className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (e.g. Marketing, Finance, Client Work)"
              className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Link (optional)"
              className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay md:col-span-2"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="h-24 resize-none rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay md:col-span-2"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={add} className={!title.trim() || saving ? "opacity-50" : ""}>
              {saving ? "Saving…" : "Save resource"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-sand bg-cream px-4 py-3">
        <Search size={18} className="text-clay" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your knowledge base"
          className="flex-1 bg-transparent text-sm text-brown outline-none placeholder:text-brown-mid/50"
        />
      </div>

      {openItem ? (
        <div>
          <button
            onClick={() => { setOpenItem(null); setEditingNotes(false); }}
            className="mb-4 flex items-center gap-1 text-xs font-semibold text-clay hover:underline"
          >
            <ArrowLeft size={14} /> Back to Knowledge Base
          </button>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-brown">{openItem.title}</h2>
                <div className="mt-2 flex items-center gap-2">
                  {openItem.type && <Badge tone="clay">{openItem.type}</Badge>}
                  {openItem.topic && (
                    <span className="text-[11px] text-brown-mid">{openItem.topic}</span>
                  )}
                  {openItem.url && (
                    <a
                      href={openItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-copper hover:underline"
                    >
                      <ExternalLink size={12} /> Open link
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => remove(openItem.id).then(() => setOpenItem(null))}
                title="Delete"
                className="shrink-0 text-brown-mid hover:text-copper"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <Eyebrow>Notes</Eyebrow>
                {!editingNotes && (
                  <button
                    onClick={() => { setEditNotesVal(openItem.notes ?? ""); setEditingNotes(true); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-clay hover:underline"
                  >
                    <Pencil size={12} /> Edit notes
                  </button>
                )}
              </div>

              {editingNotes ? (
                <div>
                  <textarea
                    value={editNotesVal}
                    onChange={(e) => setEditNotesVal(e.target.value)}
                    className="h-64 w-full resize-y rounded-xl border border-sand bg-light px-4 py-3 text-sm leading-relaxed text-brown outline-none focus:border-clay"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => updateNotes(openItem.id, editNotesVal)}>
                      Save notes
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingNotes(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-brown-mid">
                  {openItem.notes || "No notes yet. Click 'Edit notes' to add some."}
                </div>
              )}
            </div>

            <div className="mt-6">
              <TopicEditor id={openItem.id} topic={openItem.topic} onSave={updateTopic} />
            </div>
          </Card>
        </div>
      ) : (
        <>
          {loaded && items.length === 0 && (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <FileText size={28} className="text-clay" />
              <p className="mt-3 text-lg font-semibold text-brown">Your knowledge base is empty.</p>
              <p className="mt-1 max-w-md text-sm text-brown-mid">
                Add your SOPs, templates, scripts, research, and useful links so everything lives in
                one searchable place.
              </p>
              <Button className="mt-5" onClick={() => setShowForm(true)}>
                <Plus size={15} /> Add your first resource
              </Button>
            </Card>
          )}

          {items.length > 0 && grouped.length === 0 && (
            <p className="text-sm text-brown-mid">No resources match "{search}".</p>
          )}

          {grouped.map(({ topic: t, items: ks }) => (
            <div key={t} className="mb-8">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-brown-mid">
                {t}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ks.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => { setOpenItem(k); setEditingNotes(false); }}
                    className="group rounded-2xl border border-sand bg-cream/80 p-5 text-left shadow-[0_1px_2px_rgba(61,43,31,0.04)] hover:border-clay"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-clay-light text-copper">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-brown">{k.title}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {k.type && <Badge tone="clay">{k.type}</Badge>}
                          {k.url && (
                            <span className="text-[11px] font-semibold text-copper">Link</span>
                          )}
                        </div>
                        {k.notes && (
                          <p className="mt-2 line-clamp-2 text-xs leading-snug text-brown-mid">
                            {k.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
