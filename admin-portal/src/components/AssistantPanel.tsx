import { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";

const suggestedPrompts = [
  "What should I focus on this week?",
  "Where is my biggest revenue opportunity?",
  "What content should I create next?",
  "Which relationships need nurturing?",
  "What am I neglecting?",
];

// Canned, brand-voiced responses for the prototype (no backend yet).
const cannedReply =
  "Three things matter most this week.\n\n" +
  "First, Maya at Sankofa Wellness is your fastest close. The proposal's been out 6 days and her last note read warm. Send the one-line nudge today.\n\n" +
  "Second, you have enough raw material from Tuesday's strategy call for two LinkedIn posts and a newsletter. The onboarding-system story is the strongest. Draft it before the thread goes cold.\n\n" +
  "Third, you haven't touched the Atlanta Founders intro in 11 days. That's a warm referral going lukewarm.\n\n" +
  "Everything else can wait.";

type Msg = { role: "user" | "ai"; text: string };

export default function AssistantPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  function send(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }, { role: "ai", text: cannedReply }]);
    setInput("");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-brown/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col bg-cream shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brown text-clay">
              <Sparkles size={16} />
            </div>
            <div className="leading-tight">
              <p className="font-display text-lg font-bold text-brown">BOS AI</p>
              <p className="text-[11px] uppercase tracking-wider text-clay">
                Strategic Advisor
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-brown-mid hover:text-brown">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {msgs.length === 0 && (
            <div>
              <p className="mb-3 text-sm text-brown-mid">
                I watch your email, meetings, content, and pipeline. Ask me anything,
                or start here:
              </p>
              <div className="space-y-2">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full rounded-lg border border-sand bg-light px-3 py-2.5 text-left text-sm text-brown hover:border-clay hover:bg-clay-light"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-brown text-cream"
                  : "bg-light text-brown"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="border-t border-sand p-4">
          <div className="flex items-center gap-2 rounded-xl border border-sand bg-light px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask your chief of staff…"
              className="flex-1 bg-transparent text-sm text-brown outline-none placeholder:text-brown-mid/50"
            />
            <button
              onClick={() => send(input)}
              className="rounded-lg bg-clay p-1.5 text-white hover:brightness-95"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-brown-mid/60">
            Prototype responses. Wired to Claude in Phase 2.
          </p>
        </div>
      </aside>
    </>
  );
}
