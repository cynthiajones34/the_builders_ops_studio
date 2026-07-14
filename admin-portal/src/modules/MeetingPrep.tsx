import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { ClipboardList, RefreshCw, BookOpen, AlertCircle, ChevronRight } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Button } from "../components/ui";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type Submission = {
  id: string;
  name: string;
  org?: string;
  email?: string;
  submittedAt?: string;
  [key: string]: unknown;
};

type PrepResult = {
  brief: string;
  name?: string;
  org?: string;
};

export default function MeetingPrep() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [prep, setPrep] = useState<PrepResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function fetchSubmissions() {
    setLoadingList(true);
    setError(null);
    setPrep(null);
    setSelected(null);
    setSaved(false);
    try {
      const data = await callApi<Submission[]>("fetchIntakeResponses");
      setSubmissions(Array.isArray(data) ? data : []);
      setFetched(true);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load intake responses.");
    } finally {
      setLoadingList(false);
    }
  }

  async function generate(sub: Submission) {
    setSelected(sub);
    setGenerating(true);
    setPrep(null);
    setSaved(false);
    setError(null);
    try {
      const result = await callApi<PrepResult>("meetingPrep", { submission: sub });
      setPrep(result);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't generate meeting prep.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveToKb() {
    if (!user || !prep || !selected) return;
    setSaving(true);
    try {
      const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const name = prep.name || selected.name;
      const org = prep.org || selected.org || "";
      const title = `Meeting Prep: ${name}${org ? ` (${org})` : ""} - ${date}`;
      await addDoc(collection(db, "users", user.uid, "knowledge"), {
        title,
        notes: prep.brief,
        type: "Notes",
        addedAt: Date.now(),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Meeting Prep"
        sub="Pull client intake submissions and generate an AI-researched brief before every call."
        right={
          <Button variant="secondary" onClick={fetchSubmissions}>
            <RefreshCw size={15} className={loadingList ? "animate-spin" : ""} />
            {loadingList ? "Loading…" : fetched ? "Refresh" : "Load submissions"}
          </Button>
        }
      />

      {error && (
        <Card className="mb-6 flex items-start gap-2 border-copper bg-clay-light">
          <AlertCircle size={16} className="mt-0.5 text-copper" />
          <p className="text-sm text-brown">{error}</p>
        </Card>
      )}

      {!fetched && !loadingList && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList size={28} className="text-clay" />
          <p className="mt-3 text-lg font-semibold text-brown">Load your intake submissions.</p>
          <p className="mt-1 max-w-md text-sm text-brown-mid">
            Pulls responses from the Client Intake & Scoping Form and generates a research-backed
            brief for each call.
          </p>
          <Button className="mt-5" onClick={fetchSubmissions}>
            <ClipboardList size={15} /> Load submissions
          </Button>
        </Card>
      )}

      {fetched && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Submission list */}
          <div className="lg:col-span-1">
            <Card className="!p-0">
              <div className="border-b border-sand px-5 py-3">
                <Eyebrow>Intake Submissions</Eyebrow>
              </div>
              {submissions.length === 0 ? (
                <p className="px-5 py-8 text-sm text-brown-mid">No submissions found.</p>
              ) : (
                <div className="divide-y divide-sand">
                  {submissions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => generate(s)}
                      className={`flex w-full items-center justify-between px-5 py-3 text-left hover:bg-light ${
                        selected?.id === s.id ? "bg-clay-light" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-brown">{s.name}</p>
                        {s.org && <p className="text-xs text-brown-mid">{s.org}</p>}
                        {s.submittedAt && (
                          <p className="mt-0.5 text-[11px] text-brown-mid/70">{s.submittedAt}</p>
                        )}
                      </div>
                      <ChevronRight size={14} className="shrink-0 text-brown-mid" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Prep output */}
          <div className="lg:col-span-2">
            {!selected && !generating && (
              <Card className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList size={24} className="text-clay" />
                <p className="mt-3 text-sm text-brown-mid">
                  Select a submission to generate the meeting brief.
                </p>
              </Card>
            )}

            {generating && (
              <Card className="flex flex-col items-center justify-center py-16 text-center">
                <RefreshCw size={24} className="animate-spin text-clay" />
                <p className="mt-3 text-sm text-brown-mid">
                  Researching and generating brief for {selected?.name}…
                </p>
              </Card>
            )}

            {prep && !generating && (
              <Card>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <Eyebrow>Meeting Brief</Eyebrow>
                    <p className="mt-1 text-lg font-semibold text-brown">
                      {prep.name || selected?.name}
                    </p>
                    {(prep.org || selected?.org) && (
                      <p className="text-sm text-brown-mid">{prep.org || selected?.org}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={saveToKb}
                    className={saving || saved ? "opacity-70" : ""}
                  >
                    <BookOpen size={14} />
                    {saving ? "Saving…" : saved ? "Saved to KB" : "Save to KB"}
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-brown">
                  {prep.brief}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
