import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Upload,
  ArrowLeft,
  Pencil,
  Trash2,
  Search,
  X,
  ExternalLink,
  Link2,
  Users,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

const PHASES = ["Prospect", "Lead", "Active", "Completed"] as const;
type Phase = (typeof PHASES)[number];

const TAGS = [
  "Social Media",
  "Event RSVP",
  "Event Attendee",
  "Networking",
  "Discovery Call",
  "VIP Day",
  "Starter Build",
  "Growth Build",
  "Retainer-Maintenance",
  "Retainer-Growth",
  "Retainer-Partners",
] as const;

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  socialMedia?: string;
  address?: string;
  phase: Phase;
  tags: string[];
  notes?: string;
  links?: { label: string; url: string }[];
  addedAt: number;
  // Deal tracking (feeds the nightly flagging + Deal Brief dashboard).
  stage?: string;
  proposalStatus?: string;
  proposalSentDate?: string;
  dealValue?: string;
  meetingSource?: string;
  lastContactDate?: string;
  needsFollowup?: boolean;
  urgent?: boolean;
};

const STAGES = ["", "discovery", "proposal", "negotiation", "closed"] as const;
const PROPOSAL_STATUSES = ["", "not_started", "pending", "awaiting_response", "closed"] as const;

function getFullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

const PHASE_COLOR: Record<Phase, string> = {
  Prospect: "bg-sand/80 text-brown-mid",
  Lead: "bg-[#f3e9cf] text-warning",
  Active: "bg-[#e3ede3] text-positive",
  Completed: "bg-clay-light text-copper",
};

export default function Crm() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPhase, setFilterPhase] = useState<Phase | "All">("All");

  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [openContact, setOpenContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "contacts"), (snap) => {
      const all = snap.docs.map((d) => {
        const data = d.data();
        const firstName = data.firstName || data.name?.split(' ')[0] || '';
        const lastName = data.lastName || data.name?.split(' ').slice(1).join(' ') || '';
        return {
          id: d.id,
          firstName,
          lastName,
          email: data.email || '',
          phone: data.phone || '',
          socialMedia: data.socialMedia || '',
          address: data.address || '',
          phase: data.phase || 'Prospect',
          tags: Array.isArray(data.tags) ? data.tags : [],
          notes: data.notes || '',
          links: Array.isArray(data.links) ? data.links : [],
          addedAt: data.addedAt || Date.now(),
          stage: data.stage || '',
          proposalStatus: data.proposalStatus || '',
          proposalSentDate: data.proposalSentDate || '',
          dealValue: data.dealValue ? String(data.dealValue) : '',
          meetingSource: data.meetingSource || '',
          lastContactDate: data.lastContactDate || '',
          needsFollowup: !!data.needsFollowup,
          urgent: !!data.urgent,
        } as Contact;
      });
      setContacts(all);
      setLoaded(true);
      setOpenContact((prev) => (prev ? all.find((c) => c.id === prev.id) ?? null : null));
    });
  }, [user]);

  const funnelCounts = useMemo(() => {
    const map: Record<Phase, number> = { Prospect: 0, Lead: 0, Active: 0, Completed: 0 };
    contacts.forEach((c) => { if (map[c.phase] !== undefined) map[c.phase]++; });
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => filterPhase === "All" || c.phase === filterPhase)
      .filter(
        (c) =>
          !q ||
          [getFullName(c), c.email, c.phone, c.notes, ...c.tags]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
  }, [contacts, search, filterPhase]);

  async function removeContact(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "contacts", id));
  }

  if (openContact) {
    return (
      <ContactDetail
        contact={openContact}
        onBack={() => setOpenContact(null)}
        onDelete={async () => { await removeContact(openContact.id); setOpenContact(null); }}
        uid={user?.uid ?? ""}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="CRM & Relationships"
        sub="Contacts, clients, prospects, and partners. Every detail in one place."
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setShowUpload(true); setShowForm(false); }}>
              <Upload size={15} /> Import CSV
            </Button>
            <Button onClick={() => { setShowForm(true); setShowUpload(false); }}>
              <Plus size={15} /> Add contact
            </Button>
          </div>
        }
      />

      {/* Sales Funnel */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {PHASES.map((phase) => (
          <button
            key={phase}
            onClick={() => setFilterPhase(filterPhase === phase ? "All" : phase)}
            className={`rounded-2xl border p-4 text-center transition ${
              filterPhase === phase
                ? "border-clay bg-clay-light"
                : "border-sand bg-cream/80 hover:border-clay"
            }`}
          >
            <p className="font-display text-2xl font-bold text-brown">{funnelCounts[phase]}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-brown-mid">
              {phase}
            </p>
          </button>
        ))}
      </div>

      {showUpload && <CsvUpload uid={user?.uid ?? ""} onDone={() => setShowUpload(false)} />}
      {showForm && <AddContactForm uid={user?.uid ?? ""} onDone={() => setShowForm(false)} />}

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-sand bg-cream px-4 py-3">
        <Search size={18} className="text-clay" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts"
          className="flex-1 bg-transparent text-sm text-brown outline-none placeholder:text-brown-mid/50"
        />
        {filterPhase !== "All" && (
          <button onClick={() => setFilterPhase("All")} className="flex items-center gap-1 text-xs font-semibold text-clay">
            {filterPhase} <X size={12} />
          </button>
        )}
      </div>

      {loaded && contacts.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={28} className="text-clay" />
          <p className="mt-3 text-lg font-semibold text-brown">No contacts yet.</p>
          <p className="mt-1 max-w-md text-sm text-brown-mid">
            Add contacts one at a time or import a CSV to get started.
          </p>
        </Card>
      )}

      {filtered.length > 0 && (
        <Card className="!p-0">
          <div className="grid grid-cols-12 border-b border-sand px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-brown-mid">
            <span className="col-span-3">Name</span>
            <span className="col-span-2">Email</span>
            <span className="col-span-2">Phone</span>
            <span className="col-span-2">Phase</span>
            <span className="col-span-3">Tags</span>
          </div>
          <div className="divide-y divide-sand">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setOpenContact(c)}
                className="grid w-full grid-cols-12 items-center px-5 py-3 text-left hover:bg-light"
              >
                <div className="col-span-3">
                  <p className="text-sm font-semibold text-brown">{getFullName(c)}</p>
                </div>
                <p className="col-span-2 truncate text-xs text-brown-mid">{c.email || ""}</p>
                <p className="col-span-2 text-xs text-brown-mid">{c.phone || ""}</p>
                <div className="col-span-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PHASE_COLOR[c.phase]}`}>
                    {c.phase}
                  </span>
                </div>
                <div className="col-span-3 flex flex-wrap gap-1">
                  {c.tags.slice(0, 2).map((t) => (
                    <Badge key={t} tone="clay">{t}</Badge>
                  ))}
                  {c.tags.length > 2 && (
                    <span className="text-[10px] text-brown-mid">+{c.tags.length - 2}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function AddContactForm({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [socialMedia, setSocialMedia] = useState("");
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<Phase>("Prospect");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function save() {
    if (!firstName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", uid, "contacts"), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        socialMedia: socialMedia.trim(),
        address: address.trim(),
        phase,
        tags: selectedTags,
        notes: notes.trim(),
        links: [],
        addedAt: Date.now(),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <Eyebrow>New contact</Eyebrow>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name (required)"
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay" />
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone"
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay" />
        <input value={socialMedia} onChange={(e) => setSocialMedia(e.target.value)} placeholder="Social media handles"
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address"
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay md:col-span-2" />
        <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)}
          className="rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay">
          {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-brown-mid">Tags</p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                selectedTags.includes(tag) ? "bg-clay text-white" : "bg-sand/60 text-brown-mid hover:bg-sand"
              }`}>
              {tag}
            </button>
          ))}
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
        className="mt-3 h-20 w-full resize-none rounded-xl border border-sand bg-light px-3 py-2.5 text-sm text-brown outline-none focus:border-clay" />
      <div className="mt-3 flex gap-2">
        <Button onClick={save} className={!firstName.trim() || saving ? "opacity-50" : ""}>
          {saving ? "Saving..." : "Save contact"}
        </Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

function CsvUpload({ uid, onDone }: { uid: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const FIELDS = ["firstName", "lastName", "email", "phone", "socialMedia", "address", "phase", "tags", "notes"];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;
      const hdrs = parseCsvLine(lines[0]);
      setHeaders(hdrs);
      const rows = lines.slice(1, 6).map((line) => {
        const vals = parseCsvLine(line);
        const obj: Record<string, string> = {};
        hdrs.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      });
      setPreview(rows);
      const auto: Record<string, string> = {};
      hdrs.forEach((h) => {
        const lower = h.toLowerCase().replace(/[^a-z]/g, "");
        if (lower.includes("firstname")) auto[h] = "firstName";
        else if (lower.includes("lastname")) auto[h] = "lastName";
        else if (lower.includes("name") && !lower.includes("business")) auto[h] = "firstName";
        else if (lower.includes("email")) auto[h] = "email";
        else if (lower.includes("phone")) auto[h] = "phone";
        else if (lower.includes("social") || lower.includes("instagram") || lower.includes("handle")) auto[h] = "socialMedia";
        else if (lower.includes("address") || lower.includes("city") || lower.includes("zip")) auto[h] = "address";
        else if (lower.includes("phase") || lower.includes("stage") || lower.includes("status")) auto[h] = "phase";
        else if (lower.includes("tag")) auto[h] = "tags";
        else if (lower.includes("note")) auto[h] = "notes";
      });
      setMapping(auto);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!preview.length) return;
    setImporting(true);
    try {
      const fileInput = fileRef.current;
      const file = fileInput?.files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const hdrs = parseCsvLine(lines[0]);
      const rows = lines.slice(1);

      const reverseMap: Record<string, string> = {};
      Object.entries(mapping).forEach(([csvCol, field]) => {
        if (field) reverseMap[field] = csvCol;
      });

      const batch = writeBatch(db);
      let count = 0;
      for (const line of rows) {
        const vals = parseCsvLine(line);
        const obj: Record<string, string> = {};
        hdrs.forEach((h, i) => { obj[h] = vals[i] ?? ""; });

        const firstName = obj[reverseMap.firstName ?? ""]?.trim();
        if (!firstName) continue;

        const phaseVal = obj[reverseMap.phase ?? ""]?.trim() ?? "";
        const matchedPhase = PHASES.find((p) => p.toLowerCase() === phaseVal.toLowerCase()) ?? "Prospect";
        const tagsVal = obj[reverseMap.tags ?? ""]?.trim() ?? "";
        const parsedTags = tagsVal ? tagsVal.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [];

        const ref = doc(collection(db, "users", uid, "contacts"));
        batch.set(ref, {
          firstName,
          lastName: obj[reverseMap.lastName ?? ""]?.trim() ?? "",
          email: obj[reverseMap.email ?? ""]?.trim() ?? "",
          phone: obj[reverseMap.phone ?? ""]?.trim() ?? "",
          socialMedia: obj[reverseMap.socialMedia ?? ""]?.trim() ?? "",
          address: obj[reverseMap.address ?? ""]?.trim() ?? "",
          phase: matchedPhase,
          tags: parsedTags,
          notes: obj[reverseMap.notes ?? ""]?.trim() ?? "",
          links: [],
          addedAt: Date.now(),
        });
        count++;
      }
      await batch.commit();
      setResult(`✓ Successfully imported ${count} contact${count !== 1 ? 's' : ''}`);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => onDone(), 2000);
    } catch (e: any) {
      setResult(`✗ Error: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="mb-6">
      <Eyebrow>Import contacts from CSV</Eyebrow>
      <p className="mt-1 text-xs text-brown-mid">
        Upload a CSV file, then map your columns to contact fields.
      </p>
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
        className="mt-3 text-sm text-brown file:mr-3 file:rounded-lg file:border-0 file:bg-clay-light file:px-3 file:py-2 file:text-sm file:font-semibold file:text-copper hover:file:bg-sand" />

      {headers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brown-mid">Map columns</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {headers.map((h) => (
              <div key={h} className="flex items-center gap-2">
                <span className="w-28 truncate text-xs font-semibold text-brown" title={h}>{h}</span>
                <select value={mapping[h] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                  className="flex-1 rounded-lg border border-sand bg-light px-2 py-1.5 text-xs text-brown outline-none">
                  <option value="">Skip</option>
                  {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ))}
          </div>

          {preview.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-sand">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-sand bg-light">
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-brown-mid">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-sand/50">
                      {headers.map((h) => (
                        <td key={h} className="max-w-[150px] truncate px-2 py-1.5 text-brown-mid">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <Button onClick={doImport} className={importing ? "opacity-50" : ""}>
              {importing ? "Importing..." : "Import all rows"}
            </Button>
            <Button variant="ghost" onClick={onDone}>Cancel</Button>
          </div>
          {result && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
              result.startsWith('✓') ? 'bg-positive/20 text-positive' : 'bg-warning/20 text-warning'
            }`}>
              {result}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ContactDetail({
  contact,
  onBack,
  onDelete,
  uid,
}: {
  contact: Contact;
  onBack: () => void;
  onDelete: () => void;
  uid: string;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(contact.notes ?? "");
  const [editingPhase, setEditingPhase] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => { setNotesVal(contact.notes ?? ""); }, [contact.notes]);

  async function saveNotes() {
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), { notes: notesVal });
    setEditingNotes(false);
  }

  async function updatePhase(newPhase: Phase) {
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), { phase: newPhase });
    setEditingPhase(false);
  }

  async function toggleTag(tag: string) {
    const next = contact.tags.includes(tag)
      ? contact.tags.filter((t) => t !== tag)
      : [...contact.tags, tag];
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), { tags: next });
  }

  async function addLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    const next = [...(contact.links ?? []), { label: linkLabel.trim(), url: linkUrl.trim() }];
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), { links: next });
    setLinkLabel("");
    setLinkUrl("");
    setAddingLink(false);
  }

  async function removeLink(idx: number) {
    const next = (contact.links ?? []).filter((_, i) => i !== idx);
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), { links: next });
  }

  async function updateField(field: string, value: string) {
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), { [field]: value });
  }

  async function markContacted() {
    await updateDoc(doc(db, "users", uid, "contacts", contact.id), {
      lastContactDate: new Date().toISOString(),
      needsFollowup: false,
    });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-xs font-semibold text-clay hover:underline">
        <ArrowLeft size={14} /> Back to CRM
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-brown">{getFullName(contact)}</h2>
                <div className="mt-2 flex items-center gap-2">
                  {editingPhase ? (
                    <div className="flex gap-1">
                      {PHASES.map((p) => (
                        <button key={p} onClick={() => updatePhase(p)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                            contact.phase === p ? PHASE_COLOR[p] : "bg-sand/40 text-brown-mid hover:bg-sand"
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => setEditingPhase(true)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PHASE_COLOR[contact.phase]}`}>
                      {contact.phase}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={onDelete} title="Delete contact" className="text-brown-mid hover:text-copper">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField label="Email" value={contact.email} onSave={(v) => updateField("email", v)} />
              <EditableField label="Phone" value={contact.phone} onSave={(v) => updateField("phone", v)} />
              <EditableField label="Social Media" value={contact.socialMedia} onSave={(v) => updateField("socialMedia", v)} />
              <EditableField label="Address" value={contact.address} onSave={(v) => updateField("address", v)} />
            </div>
          </Card>

          {/* Deal tracking */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <Eyebrow>Deal Tracking</Eyebrow>
              <button onClick={markContacted}
                className="text-[11px] font-semibold text-clay hover:underline">
                Mark as contacted
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid/60">Stage</p>
                <select value={contact.stage || ""} onChange={(e) => updateField("stage", e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-sand bg-light px-2 py-1 text-sm text-brown outline-none focus:border-clay">
                  {STAGES.map((s) => <option key={s} value={s}>{s || "Not set"}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid/60">Proposal Status</p>
                <select value={contact.proposalStatus || ""} onChange={(e) => updateField("proposalStatus", e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-sand bg-light px-2 py-1 text-sm text-brown outline-none focus:border-clay">
                  {PROPOSAL_STATUSES.map((s) => <option key={s} value={s}>{s || "Not set"}</option>)}
                </select>
              </div>
              <EditableField label="Proposal Sent (YYYY-MM-DD)" value={contact.proposalSentDate} onSave={(v) => updateField("proposalSentDate", v)} />
              <EditableField label="Deal Value" value={contact.dealValue} onSave={(v) => updateField("dealValue", v)} />
              <EditableField label="Meeting Source" value={contact.meetingSource} onSave={(v) => updateField("meetingSource", v)} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid/60">Last Contact</p>
                <p className="mt-0.5 text-sm text-brown">
                  {contact.lastContactDate
                    ? contact.lastContactDate.slice(0, 10)
                    : <span className="text-brown-mid/40">Not set</span>}
                </p>
              </div>
            </div>
            {(contact.needsFollowup || contact.urgent) && (
              <div className="mt-3 flex gap-2 border-t border-sand pt-2">
                {contact.needsFollowup && <Badge tone="warning">Needs follow-up</Badge>}
                {contact.urgent && <Badge tone="clay">Urgent</Badge>}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <Eyebrow>Notes</Eyebrow>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-clay hover:underline">
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)}
                  className="h-40 w-full resize-y rounded-xl border border-sand bg-light px-4 py-3 text-sm leading-relaxed text-brown outline-none focus:border-clay" />
                <div className="mt-2 flex gap-2">
                  <Button onClick={saveNotes}>Save</Button>
                  <Button variant="ghost" onClick={() => { setEditingNotes(false); setNotesVal(contact.notes ?? ""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-brown-mid">
                {contact.notes || "No notes yet. Click Edit to add some."}
              </p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Tags */}
          <Card>
            <Eyebrow>Tags</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    contact.tags.includes(tag) ? "bg-clay text-white" : "bg-sand/60 text-brown-mid hover:bg-sand"
                  }`}>
                  {tag}
                </button>
              ))}
            </div>
          </Card>

          {/* Links & KB Resources */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <Eyebrow>Links & Resources</Eyebrow>
              <button onClick={() => setAddingLink(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-clay hover:underline">
                <Plus size={12} /> Add
              </button>
            </div>

            {addingLink && (
              <div className="mb-3 space-y-2 rounded-lg bg-light p-3">
                <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (e.g. Meeting Prep, Contract)"
                  className="w-full rounded-lg border border-sand bg-cream px-2.5 py-1.5 text-xs text-brown outline-none focus:border-clay" />
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL or KB path"
                  className="w-full rounded-lg border border-sand bg-cream px-2.5 py-1.5 text-xs text-brown outline-none focus:border-clay" />
                <div className="flex gap-2">
                  <Button onClick={addLink} className="!py-1 !text-xs">Save</Button>
                  <Button variant="ghost" onClick={() => setAddingLink(false)} className="!py-1 !text-xs">Cancel</Button>
                </div>
              </div>
            )}

            {(contact.links ?? []).length === 0 && !addingLink && (
              <p className="text-xs text-brown-mid/60">No links yet.</p>
            )}

            <div className="space-y-2">
              {(contact.links ?? []).map((link, i) => (
                <div key={i} className="group flex items-center gap-2">
                  <Link2 size={12} className="shrink-0 text-clay" />
                  <a href={link.url} target="_blank" rel="noreferrer"
                    className="flex-1 truncate text-xs font-semibold text-copper hover:underline">
                    {link.label}
                  </a>
                  <button onClick={() => removeLink(i)}
                    className="shrink-0 text-brown-mid/0 transition group-hover:text-brown-mid hover:!text-copper">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value ?? ""); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commit() {
    onSave(val.trim());
    setEditing(false);
  }

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid/60">{label}</p>
      {editing ? (
        <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="mt-0.5 w-full rounded-lg border border-clay bg-transparent px-2 py-1 text-sm text-brown outline-none" />
      ) : (
        <button onClick={() => setEditing(true)}
          className="mt-0.5 text-left text-sm text-brown hover:text-clay">
          {value || <span className="text-brown-mid/40">Click to add</span>}
        </button>
      )}
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
