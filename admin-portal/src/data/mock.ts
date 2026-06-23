// Prototype data. Brand-voiced, realistic for a solo ops consultant in Atlanta.
// Replaced by Firestore + real integrations in Phase 2.

export const priorities = [
  { type: "email", tone: "danger", text: "Maya (Sankofa Wellness) replied about the proposal", meta: "Reply • 6 days out" },
  { type: "meeting", tone: "clay", text: "Strategy call with Tasha, Bloom Bookkeeping", meta: "11:00 AM • 45 min" },
  { type: "deliverable", tone: "warning", text: "Onboarding SOP draft due for Glow Up Aesthetics", meta: "Due today" },
  { type: "content", tone: "clay", text: "LinkedIn post scheduled (needs your approval)", meta: "Goes out 8:00 AM" },
  { type: "opportunity", tone: "positive", text: "New: workshop inquiry from Atlanta Founders", meta: "Detected 2h ago" },
];

export const healthMetrics = [
  { label: "Revenue Pipeline", value: "$48.5K", delta: "+12% vs last month", tone: "positive" as const },
  { label: "Leads This Month", value: "14", delta: "+5 from SDR agent", tone: "positive" as const },
  { label: "Social Followers", value: "6,240", delta: "+183% YoY", tone: "positive" as const },
  { label: "Engagement Rate", value: "5.8%", delta: "+0.6 pts", tone: "positive" as const },
  { label: "Open Proposals", value: "4", delta: "$31K in play", tone: "neutral" as const },
  { label: "Open Tasks", value: "9", delta: "2 overdue", tone: "danger" as const },
];

export const briefing = {
  date: "Tuesday, June 23",
  priorities: [
    "Close the loop with Maya. The proposal's been warm for 6 days.",
    "Ship the onboarding SOP for Glow Up before the 4pm call.",
    "Approve this morning's LinkedIn post so it goes out on schedule.",
  ],
  actions: [
    "Send Tasha the systems audit template ahead of your 11am.",
    "Repurpose Tuesday's strategy call into 2 posts and a newsletter.",
  ],
  followups: [
    "Atlanta Founders intro is 11 days cold. One line reopens it.",
    "Invoice #1043 (Bloom) is 8 days past due.",
  ],
  opportunities: [
    "Three emails this week mention AI workshops. That's a productized offer waiting.",
  ],
  risks: ["Glow Up SOP is the only deliverable at risk of slipping today."],
};

export const revenueTrend = [
  { month: "Jan", pipeline: 22, closed: 8 },
  { month: "Feb", pipeline: 28, closed: 12 },
  { month: "Mar", pipeline: 31, closed: 14 },
  { month: "Apr", pipeline: 39, closed: 16 },
  { month: "May", pipeline: 43, closed: 19 },
  { month: "Jun", pipeline: 48, closed: 21 },
];

export const socialAccounts = [
  { platform: "LinkedIn", followers: "3,180", growth: "+9.2%", engagement: "6.4%", reach: "18.2K" },
  { platform: "Instagram", followers: "1,940", growth: "+4.1%", engagement: "5.1%", reach: "9.8K" },
  { platform: "TikTok", followers: "820", growth: "+22%", engagement: "7.8%", reach: "31.4K" },
  { platform: "Substack", followers: "300", growth: "+14%", engagement: "41% open", reach: "300" },
];

export const topContent = [
  { title: "You're not disorganized. You're under-systemized.", platform: "LinkedIn", metric: "412 reactions • 38 comments", pillar: "Mindset" },
  { title: "The onboarding system that runs without her", platform: "LinkedIn", metric: "287 reactions • 24 comments", pillar: "Operations" },
  { title: "3 new clients the following month", platform: "Instagram", metric: "1.2K likes • 96 saves", pillar: "Client Story" },
];

export const contentIdeas = [
  { pillar: "Operations", hook: "She had the clients. She didn't have a way to keep up.", source: "From Tuesday's call with Tasha", format: "LinkedIn (Molly Graham)" },
  { pillar: "Mindset", hook: "Asking for help isn't admitting something went wrong.", source: "From your Substack reflection notes", format: "LinkedIn + Reel" },
  { pillar: "Behind the Build", hook: "What I automated this week so I didn't have to.", source: "From your delegation dashboard", format: "TikTok script" },
  { pillar: "Client Story", hook: "Turning away work because onboarding couldn't keep up.", source: "From Glow Up project notes", format: "Instagram carousel" },
];

export const calendar = [
  { day: "Mon", date: "Jun 22", items: [{ t: "LinkedIn: Operations", tone: "clay" }] },
  { day: "Tue", date: "Jun 23", items: [{ t: "Instagram carousel", tone: "neutral" }] },
  { day: "Wed", date: "Jun 24", items: [{ t: "Substack deep-dive", tone: "positive" }] },
  { day: "Thu", date: "Jun 25", items: [] },
  { day: "Fri", date: "Jun 26", items: [{ t: "LinkedIn: Client Story", tone: "clay" }, { t: "TikTok tip", tone: "neutral" }] },
];

export const emails = [
  { from: "Maya Robinson", subject: "Re: Operations audit proposal", category: "Potential Client", tone: "danger", snippet: "This looks great. One question on the retainer tier before we…", time: "9:12 AM", priority: true },
  { from: "Atlanta Founders Collective", subject: "Speaking slot for September summit?", category: "Speaking", tone: "clay", snippet: "We'd love to have you talk about systems for early-stage…", time: "8:40 AM", priority: true },
  { from: "Jordan (Buffer)", subject: "Partnership idea for your audience", category: "Partnership", tone: "positive", snippet: "We're building a program for solo consultants and thought…", time: "Yesterday", priority: false },
  { from: "Tasha (Bloom Bookkeeping)", subject: "Notes before our call", category: "Potential Client", tone: "danger", snippet: "Wanted to share where we're stuck before tomorrow…", time: "Yesterday", priority: false },
  { from: "Voyage ATL", subject: "Feature request: local founders", category: "Media", tone: "neutral", snippet: "We're profiling Atlanta women founders this quarter…", time: "Mon", priority: false },
  { from: "QuickBooks", subject: "Invoice #1043 is past due", category: "Invoice", tone: "warning", snippet: "Your client invoice is 8 days overdue…", time: "Mon", priority: false },
];

export const emailCategories = [
  { name: "Potential Clients", count: 7, tone: "danger" },
  { name: "Speaking", count: 3, tone: "clay" },
  { name: "Partnerships", count: 2, tone: "positive" },
  { name: "Media", count: 2, tone: "neutral" },
  { name: "Networking", count: 5, tone: "clay" },
  { name: "Invoices", count: 1, tone: "warning" },
  { name: "Admin", count: 12, tone: "neutral" },
];

export const meetings = [
  {
    title: "Strategy call with Tasha, Bloom Bookkeeping",
    when: "Today • 11:00 AM",
    status: "upcoming",
    actions: [],
    summary: "Discovery for an operations audit. Tasha's drowning in client onboarding.",
  },
  {
    title: "Onboarding review with Glow Up Aesthetics",
    when: "Yesterday • 2:00 PM",
    status: "summarized",
    summary:
      "Reviewed the new onboarding flow. Owner wants to stop turning away clients. Agreed to a documented SOP plus a Notion intake form.",
    actions: ["Draft onboarding SOP (due today)", "Build Notion intake form", "Follow up on retainer in 2 weeks"],
    decisions: ["Move to a documented, repeatable onboarding"],
    opportunities: ["Upsell: monthly systems retainer once SOP lands"],
  },
  {
    title: "Substack collab with Maya Robinson",
    when: "Mon • 3:30 PM",
    status: "summarized",
    summary: "Talked content swap and a possible joint workshop on systems for wellness founders.",
    actions: ["Send proposal (done)", "Pick a September date"],
    decisions: ["Co-host one workshop in Q3"],
    opportunities: ["Workshop offer: 'Systems for Wellness Founders'"],
  },
];

export const projects = [
  { name: "Glow Up Aesthetics: Onboarding System", client: "Glow Up Aesthetics", status: "On track", health: "good", due: "Jun 30", next: "Ship SOP draft today", progress: 70 },
  { name: "Bloom Bookkeeping: Ops Audit", client: "Bloom Bookkeeping", status: "Discovery", health: "good", due: "Jul 15", next: "Strategy call at 11am", progress: 15 },
  { name: "Sankofa Wellness: Retainer", client: "Sankofa Wellness", status: "Proposal out", health: "watch", due: "TBD", next: "Nudge Maya on proposal", progress: 40 },
  { name: "Q3 Content System", client: "Internal", status: "On track", health: "good", due: "Jul 1", next: "Repurpose call notes", progress: 55 },
];

export const contacts = [
  { name: "Maya Robinson", org: "Sankofa Wellness", type: "Prospect", last: "Today", warmth: "hot", note: "Proposal out 6 days. Warm. Nudge." },
  { name: "Tasha Greene", org: "Bloom Bookkeeping", type: "Prospect", last: "Yesterday", warmth: "hot", note: "Discovery call today." },
  { name: "Atlanta Founders Collective", org: "Community", type: "Partner", last: "11 days", warmth: "cooling", note: "Intro going cold. Reopen." },
  { name: "Jordan Lee", org: "Buffer", type: "Partner", last: "Yesterday", warmth: "warm", note: "Partnership idea pending." },
  { name: "Glow Up Aesthetics", org: "Glow Up", type: "Client", last: "2 days", warmth: "active", note: "Active engagement." },
  { name: "Voyage ATL", org: "Media", type: "Media", last: "Mon", warmth: "warm", note: "Feature opportunity." },
];

export const pipeline = [
  { stage: "New Lead", deals: [{ name: "Wellness studio referral", value: "$6K", from: "SDR agent" }, { name: "IG inbound: bakery", value: "$4K", from: "Instagram" }] },
  { stage: "Qualified", deals: [{ name: "Bloom Bookkeeping", value: "$9K", from: "Referral" }] },
  { stage: "Proposal", deals: [{ name: "Sankofa Wellness", value: "$12K", from: "Substack" }, { name: "Glow Up retainer", value: "$7.5K", from: "Existing" }] },
  { stage: "Won", deals: [{ name: "Glow Up: Onboarding", value: "$5K", from: "Inbound" }] },
];

export const opportunities = [
  { type: "Workshop", tone: "clay", title: "AI workshops for solo founders", evidence: "3 emails + 1 meeting mention this in the last 7 days.", value: "Est. $3–8K / cohort" },
  { type: "Speaking", tone: "positive", title: "Atlanta Founders September summit", evidence: "Direct invite this morning. Audience = your exact ICP.", value: "Pipeline + brand" },
  { type: "Productized Offer", tone: "clay", title: "'Onboarding System in a Week'", evidence: "Pattern across Glow Up + 2 past clients.", value: "Repeatable $5K offer" },
  { type: "Referral", tone: "warning", title: "Reopen Atlanta Founders intro", evidence: "Warm intro idle 11 days.", value: "1–2 warm leads" },
];

export const knowledgeItems = [
  { title: "Client Onboarding SOP (master template)", type: "SOP", tag: "Operations" },
  { title: "Discovery call script", type: "Template", tag: "Sales" },
  { title: "Operations audit checklist", type: "Template", tag: "Operations" },
  { title: "Molly Graham LinkedIn framework", type: "Reference", tag: "Content" },
  { title: "Retainer pricing tiers", type: "Reference", tag: "Pricing" },
  { title: "Glow Up: meeting notes archive", type: "Notes", tag: "Client" },
];

export const recommendations = [
  { tone: "danger", text: "You haven't followed up with Atlanta Founders in 11 days.", action: "Send intro nudge" },
  { tone: "clay", text: "Glow Up mentioned needing a monthly retainer. That's an upsell.", action: "Draft retainer offer" },
  { tone: "positive", text: "Several emails indicate interest in AI workshops.", action: "Build the offer" },
  { tone: "clay", text: "You have enough from this week's meetings for 2 posts and 1 newsletter.", action: "Generate drafts" },
];
