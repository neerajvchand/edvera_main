import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth";
import { useSession } from "@/hooks/useSession";
import { usePermission } from "@/hooks/usePermission";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ClipboardList,
  Upload,
  FileBarChart,
  BookOpen,
  DollarSign,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/actions", label: "Actions", icon: ClipboardList },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/reference/education-code", label: "Legal reference", icon: BookOpen },
  { to: "/funding", label: "Funding", icon: DollarSign },
];

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useSession();
  const { canAccessRoute } = usePermission();
  const navigate = useNavigate();

  const mainNavItems = NAV_ITEMS.filter((item) => canAccessRoute(item.to));

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between h-11 px-5 bg-brand-500 shrink-0">
        <div className="flex items-center gap-3">
          <svg width="26" height="26" viewBox="0 0 100 100" fill="none" className="shrink-0">
            <rect width="100" height="100" rx="18" fill="rgba(255,255,255,0.1)"/>
            <rect x="18" y="28" width="54" height="10" rx="5" fill="#2dd4a8"/>
            <rect x="18" y="44" width="40" height="10" rx="5" fill="#1aad8a"/>
            <rect x="18" y="60" width="26" height="10" rx="5" fill="#0f8a6e"/>
            <path d="M52 64 L62 74 L78 52" stroke="#2dd4a8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <span className="text-white text-sm font-medium tracking-tight">
            edver<span className="opacity-60">a</span>
          </span>
          <span className="text-white/30 mx-1">|</span>
          <span className="text-white/70 text-xs">Attendance Console</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-white/10 text-white text-[11px] px-3 py-1 rounded-full">
            Pacific Unified SD
          </span>
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[11px] text-white">
            {user?.email?.charAt(0).toUpperCase() ?? "A"}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col border-r border-gray-200 bg-white transition-all duration-200",
            collapsed ? "w-14" : "w-[180px]"
          )}
        >
          {/* Nav */}
          <nav className="flex-1 py-3 space-y-0.5">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 text-[clamp(13px,1vw,15px)] transition-colors border-l-2",
                    isActive
                      ? "border-brand-500 bg-blue-50 text-blue-800 font-semibold"
                      : "border-transparent text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-700"
                  )
                }
              >
                <item.icon className="h-[15px] w-[15px] shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Bottom */}
          <div className="border-t border-gray-100 py-2 space-y-0.5">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 w-full transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="h-[14px] w-[14px] shrink-0 mx-auto" />
              ) : (
                <>
                  <ChevronLeft className="h-[14px] w-[14px] shrink-0" />
                  <span>Collapse</span>
                </>
              )}
            </button>

            {canAccessRoute("/settings") && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 text-[clamp(13px,1vw,15px)] transition-colors border-l-2",
                    isActive
                      ? "border-brand-500 bg-blue-50 text-blue-800 font-semibold"
                      : "border-transparent text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-700"
                  )
                }
              >
                <Settings className="h-[15px] w-[15px] shrink-0" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            )}

            {canAccessRoute("/security") && (
              <NavLink
                to="/security"
                className="flex items-center gap-2 px-4 py-2 text-[clamp(13px,1vw,15px)] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors border-l-2 border-transparent"
              >
                <Shield className="h-[15px] w-[15px] shrink-0" />
                {!collapsed && <span>Security</span>}
              </NavLink>
            )}

            {!collapsed && (
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 truncate">
                    {user?.email ?? ""}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
