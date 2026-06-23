import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Sparkles, Search, Bell, Plus } from "lucide-react";
import { sections, groups } from "../nav";
import AssistantPanel from "./AssistantPanel";

export default function Shell() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const loc = useLocation();
  const active = sections.find((s) => loc.pathname.startsWith(s.path));

  return (
    <div className="flex h-screen overflow-hidden bg-light text-brown">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-sand bg-brown text-cream">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clay font-display text-lg font-bold text-brown">
            B
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-bold">Command Center</p>
            <p className="text-[11px] uppercase tracking-wider text-clay">
              The Builders' Ops Studio
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group} className="mb-4">
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-clay/70">
                {group}
              </p>
              {sections
                .filter((s) => s.group === group)
                .map((s) => (
                  <NavLink
                    key={s.path}
                    to={s.path}
                    className={({ isActive }) =>
                      `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "bg-clay text-brown"
                          : "text-cream/80 hover:bg-white/5 hover:text-cream"
                      }`
                    }
                  >
                    <s.icon size={17} />
                    {s.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay font-bold text-brown">
              CJ
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Cynthia Jones</p>
              <p className="text-[11px] text-clay">Founder</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b border-sand bg-cream/70 px-7 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brown-mid">
            {active?.group} <span className="text-clay">/</span> {active?.label}
          </div>
          <div className="relative ml-auto w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brown-mid/60"
            />
            <input
              placeholder="Search everything…"
              className="w-full rounded-lg border border-sand bg-light py-2 pl-9 pr-3 text-sm text-brown outline-none placeholder:text-brown-mid/50 focus:border-clay"
            />
          </div>
          <button className="rounded-lg border border-sand bg-light p-2 text-brown-mid hover:text-brown">
            <Plus size={17} />
          </button>
          <button className="relative rounded-lg border border-sand bg-light p-2 text-brown-mid hover:text-brown">
            <Bell size={17} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-copper" />
          </button>
          <button
            onClick={() => setAssistantOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brown px-3.5 py-2 text-sm font-semibold text-cream hover:bg-brown-mid"
          >
            <Sparkles size={16} /> Ask BOS AI
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-7 py-7">
          <Outlet />
        </main>
      </div>

      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
