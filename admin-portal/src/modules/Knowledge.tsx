import { useEffect, useMemo, useState } from "react";
import { Search, FileText, Plus, X, ExternalLink, Trash2 } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type Resource = {
  id: string;
  title: string;
  url?: string;
  notes?: string;
  type?: string;
  addedAt?: number;
};

const TYPES = ["Link", "SOP", "Template", "Reference", "Notes"];

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
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "knowledge"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Resource, "id">) })));
      setLoaded(true);
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
        addedAt: Date.now(),
      });
      setTitle("");
      setUrl("");
      setNotes("");
      setType("Link");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "knowledge", id));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...items].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
    if (!q) return list;
    return list.filter((k) =>
      [k.title, k.notes, k.type].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
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

      {items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-brown-mid">No resources match "{search}".</p>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((k) => (
            <Card key={k.id} className="group flex items-start gap-3 hover:border-clay">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-clay-light text-copper">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-brown">{k.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {k.type && <Badge tone="clay">{k.type}</Badge>}
                  {k.url && (
                    <a
                      href={k.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-copper hover:underline"
                    >
                      <ExternalLink size={12} /> Open
                    </a>
                  )}
                </div>
                {k.notes && <p className="mt-2 text-xs leading-snug text-brown-mid">{k.notes}</p>}
              </div>
              <button
                onClick={() => remove(k.id)}
                title="Delete"
                className="shrink-0 text-brown-mid/0 transition group-hover:text-brown-mid hover:!text-copper"
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
