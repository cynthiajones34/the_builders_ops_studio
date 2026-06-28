import { useEffect, useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Card, SectionTitle, Badge, Button } from "../components/ui";
import { callApi } from "../lib/api";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type Project = {
  name: string;
  client?: string;
  status: string;
  summary?: string;
  nextSteps?: string[];
  source?: string;
};

const statusTone: Record<string, any> = {
  "on track": "positive",
  "needs attention": "danger",
  waiting: "warning",
};

const now = new Date();
const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [grounded, setGrounded] = useState(true);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setState("loading");
    setError(null);
    try {
      const cacheRef = doc(db, "users", user.uid, "state", "projects");
      const snap = await getDoc(cacheRef);

      if (snap.exists()) {
        const d = snap.data() as any;
        if (d.date === todayKey && Array.isArray(d.projects)) {
          setProjects(d.projects ?? []);
          setGrounded(d.grounded ?? true);
          setState("ready");
          return;
        }
      }

      const r = await callApi<{ projects: Project[]; grounded: boolean }>("generateProjects");
      setProjects(r.projects ?? []);
      setGrounded(r.grounded);
      setState("ready");
      await setDoc(cacheRef, { date: todayKey, projects: r.projects ?? [], grounded: r.grounded });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't build projects.");
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Projects"
        sub="Active workstreams pulled from your meetings and email. Every conversation updates where things stand."
        right={
          <Button variant="secondary" onClick={() => state !== "loading" && load()}>
            <RefreshCw size={15} className={state === "loading" ? "animate-spin" : ""} />
            {state === "loading" ? "Reading…" : "Refresh"}
          </Button>
        }
      />

      {state === "loading" && (
        <Card className="py-12 text-center text-sm text-brown-mid">
          Reading your meetings and inbox, pulling out what's in motion…
        </Card>
      )}

      {state === "error" && (
        <Card className="flex items-start gap-2 border-copper bg-clay-light">
          <AlertCircle size={16} className="mt-0.5 text-copper" />
          <p className="text-sm text-brown">{error}</p>
        </Card>
      )}

      {state === "ready" && !grounded && (
        <Card className="py-12 text-center text-sm text-brown-mid">
          Connect Gmail and sync your meetings first, then your active projects build themselves
          from the activity.
        </Card>
      )}

      {state === "ready" && grounded && projects && projects.length === 0 && (
        <Card className="py-12 text-center text-sm text-brown-mid">
          No active workstreams surfaced from recent activity.
        </Card>
      )}

      {state === "ready" && grounded && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p, i) => (
            <Card key={i} className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  {p.client && (
                    <p className="text-[11px] uppercase tracking-wider text-clay">{p.client}</p>
                  )}
                  <h2 className="font-display text-lg font-bold leading-snug text-brown">
                    {p.name}
                  </h2>
                </div>
                <Badge tone={statusTone[p.status] ?? "neutral"}>{p.status}</Badge>
              </div>

              {p.summary && <p className="mt-2 text-sm text-brown-mid">{p.summary}</p>}

              {p.nextSteps && p.nextSteps.length > 0 && (
                <div className="mt-3 border-t border-sand pt-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-brown-mid">
                    Next steps
                  </p>
                  <ul className="space-y-1">
                    {p.nextSteps.map((s, j) => (
                      <li key={j} className="flex gap-1.5 text-sm leading-snug text-brown">
                        <span className="text-clay">·</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {p.source && <p className="mt-3 text-[11px] italic text-brown-mid/70">From {p.source}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
