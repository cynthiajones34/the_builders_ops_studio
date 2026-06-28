import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Sparkles, Search, Bell, Plus, LogOut, X } from "lucide-react";
import { sections, groups } from "../nav";
import AssistantPanel from "./AssistantPanel";
import { useAuth } from "../lib/AuthContext";

export default function Shell() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasNotifications] = useState(false);
  const loc = useLocation();
  const active = sections.find((s) => loc.pathname.startsWith(s.path));
  const { user, logout } = useAuth();

  const displayName = user?.displayName ?? "Cynthia Jones";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-light text-brown">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-sand bg-brown text-cream">
        <div className="flex items-center gap-3 px-5 py-5">
          <img
            src="/favicon.png"
            alt="BOS"
            className="h-9 w-9 rounded-lg object-cover"
          />
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
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                className="h-9 w-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay font-bold text-brown">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-[11px] text-clay">Founder</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-lg p-1.5 text-cream/60 transition hover:bg-white/10 hover:text-cream"
            >
              <LogOut size={16} />
            </button>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              className="w-full rounded-lg border border-sand bg-light py-2 pl-9 pr-3 text-sm text-brown outline-none placeholder:text-brown-mid/50 focus:border-clay"
            />
          </div>
          <button
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="relative rounded-lg border border-sand bg-light p-2 text-brown-mid hover:text-brown"
            title="Add new"
          >
            <Plus size={17} />
          </button>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-lg border border-sand bg-light p-2 text-brown-mid hover:text-brown"
            title="Notifications"
          >
            <Bell size={17} />
            {hasNotifications && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-copper" />
            )}
          </button>
          <button
            onClick={() => setAssistantOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brown px-3.5 py-2 text-sm font-semibold text-cream hover:bg-brown-mid"
          >
            <Sparkles size={16} /> Ask BOS AI
          </button>
        </header>

        {/* Search Results Modal */}
        {searchOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)}>
            <div
              className="absolute top-16 right-7 w-96 rounded-xl border border-sand bg-white shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-sand p-4">
                <p className="text-sm font-semibold text-brown">Search</p>
              </div>
              {searchQuery.trim() ? (
                <div className="max-h-96 overflow-y-auto p-4">
                  <p className="text-sm text-brown-mid">
                    Search for "{searchQuery}" across all modules…
                  </p>
                  <p className="mt-3 text-xs italic text-brown-mid/60">
                    Detailed search coming soon. For now, use the search within each module.
                  </p>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm text-brown-mid">
                    Type to search across contacts, projects, opportunities, and more.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Menu */}
        {addMenuOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)}>
            <div
              className="absolute top-16 right-28 w-56 rounded-xl border border-sand bg-white shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-sand p-4">
                <p className="text-sm font-semibold text-brown">Create New</p>
              </div>
              <nav className="divide-y divide-sand">
                <NavLink
                  to="/crm"
                  onClick={() => setAddMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-brown hover:bg-light"
                >
                  Add Contact
                </NavLink>
                <NavLink
                  to="/opportunities"
                  onClick={() => setAddMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-brown hover:bg-light"
                >
                  Add Opportunity
                </NavLink>
                <NavLink
                  to="/content"
                  onClick={() => setAddMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-brown hover:bg-light"
                >
                  Generate Content Idea
                </NavLink>
              </nav>
            </div>
          </div>
        )}

        {/* Notifications Panel */}
        {notificationsOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)}>
            <div
              className="absolute top-16 right-16 w-80 rounded-xl border border-sand bg-white shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-sand p-4">
                <p className="text-sm font-semibold text-brown">Notifications</p>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-brown-mid hover:text-brown"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto p-4">
                <p className="text-sm text-brown-mid">
                  You're all caught up. No new notifications.
                </p>
                <p className="mt-3 text-xs italic text-brown-mid/60">
                  Real-time notifications coming soon.
                </p>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-7 py-7">
          <Outlet />
        </main>
      </div>

      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
