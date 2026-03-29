import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { setAuthMode } from "@/lib/authMode";
import { useSession } from "@/hooks/useSession";
import { signOut } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard,
  School,
  Megaphone,
  ClipboardCheck,
  ChevronDown,
  LogOut,
  ArrowRightLeft,
  Home,
  User,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import edveraLogo from "@/assets/edvera_logo.png";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/school-profile", label: "School Profile", icon: School },
  { to: "/admin/comms", label: "Communications", icon: Megaphone },
  { to: "/admin/attendance-triage", label: "Attendance Triage", icon: ClipboardCheck },
  { to: "/admin/documents", label: "Documents", icon: FileText },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useSession();
  const { memberships, activeMembership, selectSchool, role, schoolName } =
    useAdminMembership();

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    localStorage.removeItem("edvera_auth_mode");
    localStorage.removeItem("edvera_default_view");
    navigate("/", { replace: true });
  };

  const handleSwitchToParent = () => {
    setAuthMode("parent");
    navigate("/", { replace: true });
  };

  const roleLabel = role ? role.replace(/_/g, " ") : "Staff";

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background">
      {/* Top banner */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center gap-3">
          {/* Left: Logo + school identity */}
          <Link to="/admin" className="flex items-center gap-2.5 shrink-0">
            <img src={edveraLogo} alt="Edvera" className="h-8 w-auto mix-blend-multiply" />
          </Link>

          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-semibold text-primary tracking-widest uppercase leading-tight">
              Admin Portal
            </span>
            {schoolName && (
              <span className="text-sm font-semibold text-foreground truncate leading-tight">
                {schoolName}
              </span>
            )}
          </div>

          {/* School switcher (multi-school only) */}
          {memberships.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-input hover:bg-secondary/60 transition-colors">
                Switch School <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.school_id}
                    onClick={() => selectSchool(m.school_id)}
                    className={cn(
                      "cursor-pointer",
                      m.school_id === activeMembership?.school_id && "font-semibold"
                    )}
                  >
                    {m.school_name} ({m.role})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex-1" />

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Role badge — hidden on mobile */}
            {!isMobile && role && (
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium capitalize whitespace-nowrap">
                {roleLabel}
              </span>
            )}

            {/* View switcher — hidden on mobile (moved into avatar menu) */}
            {!isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Switch View
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={handleSwitchToParent} className="cursor-pointer">
                    <Home className="w-4 h-4 mr-2" />
                    Parent View
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="cursor-default opacity-50">
                    <School className="w-4 h-4 mr-2" />
                    Staff Portal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Avatar / User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-shadow hover:shadow-md"
                  aria-label="Account menu"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium truncate">{user?.email ?? "—"}</p>
                  {isMobile && role && (
                    <p className="text-xs text-primary capitalize mt-0.5">{roleLabel}</p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Mobile-only: view switch */}
                {isMobile && (
                  <>
                    <DropdownMenuItem onClick={handleSwitchToParent} className="cursor-pointer">
                      <Home className="w-4 h-4 mr-2" />
                      Parent View
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
