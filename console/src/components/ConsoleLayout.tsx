import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth";
import { useSession } from "@/hooks/useSession";
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
  { to: "/reference/education-code", label: "Legal Reference", icon: BookOpen },
  { to: "/funding", label: "Funding", icon: DollarSign },
];

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-gray-200 bg-white transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-gray-100">
          {!collapsed ? (
            <img
              src="/logo.png"
              alt="Edvera"
              className="w-[100px] h-auto"
            />
          ) : (
            <span className="text-lg font-bold mx-auto" style={{ color: "#0a1128" }}>
              e
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-100 p-2 space-y-0.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-[18px] w-[18px] shrink-0 mx-auto" />
            ) : (
              <>
                <ChevronLeft className="h-[18px] w-[18px] shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )
            }
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Settings</span>}
          </NavLink>

          <NavLink
            to="/security"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Shield className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Security</span>}
          </NavLink>

          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-900 font-medium truncate">
                  {user?.email ?? ""}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
