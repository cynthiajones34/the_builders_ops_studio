import { Search, FileText, Sparkles } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { knowledgeItems } from "../data/mock";

export default function Knowledge() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Knowledge Base"
        sub="Meeting notes, SOPs, templates, research, and client info. Semantic search and AI chat across everything."
        right={<Button>Add document</Button>}
      />

      <Card className="mb-6 bg-brown text-cream">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-clay" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-clay">
            Ask your knowledge base
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3">
          <Search size={18} className="text-clay" />
          <input
            placeholder="What's our standard onboarding SOP? What did Glow Up need?"
            className="flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-cream/50"
          />
          <Button variant="accent" className="!py-1.5 text-xs">Ask</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {knowledgeItems.map((k, i) => (
          <Card key={i} className="flex items-start gap-3 hover:border-clay">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-clay-light text-copper">
              <FileText size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-snug text-brown">{k.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone="clay">{k.type}</Badge>
                <span className="text-[11px] text-brown-mid">{k.tag}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
