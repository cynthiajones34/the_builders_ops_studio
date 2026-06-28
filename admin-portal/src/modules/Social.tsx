import { useEffect, useState } from "react";
import { Sparkles, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Card, Eyebrow, SectionTitle, Badge, Button } from "../components/ui";
import { callApi } from "../lib/api";

type Account = {
  platform: string;
  username: string;
  followers: string;
  growth: string;
  engagement: string;
  reach: string;
};

type TopPost = {
  title: string;
  metric: string;
  pillar: string;
};

const insights = [
  { tone: "positive", text: "Mindset content is outperforming everything. Your 'under-systemized' post drove 38% of weekly engagement." },
  { tone: "warning", text: "Pure how-to Operations posts are underperforming. Wrap them in a client story." },
  { tone: "clay", text: "TikTok is your fastest-growing channel (+22%). Founder-story voiceovers are landing." },
  { tone: "clay", text: "Best posting windows: Tue 8am and Fri 12pm. Your audience is most active then." },
];

export default function Social() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [topContent, setTopContent] = useState<TopPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSocialData();
  }, []);

  async function loadSocialData() {
    setLoading(true);
    setError(null);
    try {
      const [igRes, liRes, ttRes] = await Promise.all([
        callApi<any>("instagramInsights").catch(() => ({ connected: false })),
        callApi<any>("linkedinInsights").catch(() => ({ connected: false })),
        callApi<any>("tiktokInsights").catch(() => ({ connected: false })),
      ]);

      const allAccounts: Account[] = [];
      const allPosts: TopPost[] = [];

      if (igRes.connected && igRes.account) {
        allAccounts.push(igRes.account);
        if (igRes.topPosts) allPosts.push(...igRes.topPosts);
      }
      if (liRes.connected && liRes.account) {
        allAccounts.push(liRes.account);
        if (liRes.topPosts) allPosts.push(...liRes.topPosts);
      }
      if (ttRes.connected && ttRes.account) {
        allAccounts.push(ttRes.account);
        if (ttRes.topPosts) allPosts.push(...ttRes.topPosts);
      }

      setAccounts(allAccounts);
      setTopContent(allPosts);
    } catch (err) {
      console.error("Failed to load social data:", err);
      setError("Couldn't load social data. Try connecting an account.");
    } finally {
      setLoading(false);
    }
  }

  async function connectAccount(platform: string) {
    try {
      const res = await callApi<{ url: string }>(`${platform.toLowerCase()}AuthUrl`);
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(`Couldn't connect ${platform}. Try again.`);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Social Command"
        sub="Instagram, TikTok, LinkedIn in one view. The numbers, and what they mean."
        right={
          <div className="flex gap-2">
            {!accounts.some((a) => a.platform === "Instagram") && (
              <Button variant="secondary" onClick={() => connectAccount("Instagram")} className="text-xs">
                <LinkIcon size={14} /> Connect Instagram
              </Button>
            )}
            {!accounts.some((a) => a.platform === "LinkedIn") && (
              <Button variant="secondary" onClick={() => connectAccount("LinkedIn")} className="text-xs">
                <LinkIcon size={14} /> Connect LinkedIn
              </Button>
            )}
            {!accounts.some((a) => a.platform === "TikTok") && (
              <Button variant="secondary" onClick={() => connectAccount("TikTok")} className="text-xs">
                <LinkIcon size={14} /> Connect TikTok
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <Card className="mb-6 flex items-start gap-2 border-copper bg-clay-light">
          <AlertCircle size={16} className="mt-0.5 text-copper" />
          <p className="text-sm text-brown">{error}</p>
        </Card>
      )}

      {loading && (
        <Card className="mb-6 py-12 text-center text-sm text-brown-mid">
          Loading social accounts…
        </Card>
      )}

      {!loading && accounts.length === 0 && (
        <Card className="mb-6 py-12 text-center text-sm text-brown-mid">
          Connect your social accounts to see analytics and top-performing content.
        </Card>
      )}

      {!loading && accounts.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accounts.map((a) => (
            <Card key={a.platform}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-brown">{a.platform}</p>
                <Badge tone="positive">{a.growth}</Badge>
              </div>
              <p className="mt-2 font-display text-3xl font-bold text-brown">{a.followers}</p>
              <p className="text-xs text-brown-mid">followers</p>
              <div className="mt-3 flex justify-between border-t border-sand pt-2 text-xs text-brown-mid">
                <span>Engagement {a.engagement}</span>
                <span>Reach {a.reach}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && topContent.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <Eyebrow>Top-Performing Content</Eyebrow>
            <div className="mt-2 divide-y divide-sand">
              {topContent.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <span className="font-display text-2xl font-bold text-clay">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug text-brown">{c.title}</p>
                    <p className="text-xs text-brown-mid">{c.metric}</p>
                  </div>
                  <Badge tone="clay">{c.pillar}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-brown text-cream">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-clay" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
                AI Insights
              </p>
            </div>
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <p key={i} className="flex gap-2 text-sm leading-snug text-cream/90">
                  <span className="text-clay">›</span>
                  {ins.text}
                </p>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
