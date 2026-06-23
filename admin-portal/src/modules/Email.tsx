import { Mail, Sparkles, Star } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { emails, emailCategories } from "../data/mock";

export default function Email() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Email Intelligence"
        sub="Gmail, sorted by what it means for the business. Opportunities surface themselves."
        right={
          <Button variant="secondary">
            <Mail size={15} /> Connect Gmail
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Categories */}
        <div className="lg:col-span-1">
          <Card>
            <Eyebrow>Auto-Categorized</Eyebrow>
            <div className="mt-2 space-y-1">
              {emailCategories.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-clay-light"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background:
                          c.tone === "danger"
                            ? "#A0522D"
                            : c.tone === "clay"
                            ? "#C4956A"
                            : c.tone === "positive"
                            ? "#4F7A4F"
                            : c.tone === "warning"
                            ? "#B8860B"
                            : "#E8DCC8",
                      }}
                    />
                    <span className="text-sm text-brown">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-brown-mid">{c.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mt-4 bg-brown text-cream">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={15} className="text-clay" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-clay">
                AI noticed
              </p>
            </div>
            <p className="text-sm leading-snug text-cream/90">
              Three emails this week mention AI workshops. That's a productized offer
              waiting to be built.
            </p>
            <Button variant="accent" className="mt-3 !py-1.5 text-xs">
              Send to Opportunity Engine
            </Button>
          </Card>
        </div>

        {/* Inbox */}
        <div className="lg:col-span-3">
          <Card className="!p-0">
            <div className="flex items-center justify-between border-b border-sand px-5 py-3">
              <Eyebrow>Priority Inbox</Eyebrow>
              <span className="text-xs text-brown-mid">Sorted by business impact</span>
            </div>
            <div className="divide-y divide-sand">
              {emails.map((e, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-light"
                >
                  <Star
                    size={16}
                    className={e.priority ? "mt-0.5 fill-clay text-clay" : "mt-0.5 text-sand"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-brown">{e.from}</p>
                      <Badge tone={e.tone as any}>{e.category}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-brown">{e.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-brown-mid">{e.snippet}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-brown-mid">{e.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
