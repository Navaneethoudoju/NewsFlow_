import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Newspaper,
  FolderKanban,
  BellRing,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useAlerts } from "../hooks/useDashboard";

function NavItem({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-masthead text-white" : "text-paper/85 hover:bg-white/10"
        }`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="rounded-full bg-status-overdue px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isEditor = user?.role === "EDITOR";
  const { data: alerts } = useAlerts();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full flex-col bg-ink text-white" onClick={onNavigate}>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-masthead" />
          <span className="font-serif text-lg font-semibold tracking-tight">NewsFlow</span>
        </div>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-paper/50 font-mono">Editorial desk</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavItem to="/dashboard" icon={<LayoutDashboard size={17} />} label="Dashboard" />
        <NavItem to="/articles" icon={<Newspaper size={17} />} label="Articles" />
        <NavItem to="/sections" icon={<FolderKanban size={17} />} label="Sections" />
        {isEditor && (
          <NavItem to="/alerts" icon={<BellRing size={17} />} label="Alerts" badge={alerts?.count} />
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="text-xs text-paper/50">{user?.role === "EDITOR" ? "Editor" : "Writer"} · {user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-paper/80 hover:bg-white/10"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile topbar + drawer */}
      <div className="flex items-center justify-between border-b border-rule bg-ink px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 text-white">
          <span className="h-2 w-2 rounded-full bg-masthead" />
          <span className="font-serif text-base font-semibold">NewsFlow</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white" aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
          <button
            className="flex-1 bg-ink/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <span className="sr-only">Close</span>
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-4 top-4 text-white"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
