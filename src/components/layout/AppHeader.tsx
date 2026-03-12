import { ChevronDown, Settings, LogOut, User, Users, Check, Shield } from 'lucide-react';
import { useLanguage } from "@/i18n/LanguageContext";
import { useSession } from "@/hooks/useSession";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { setAuthMode } from "@/lib/authMode";
import { signOut } from "@/lib/auth";
import { useNavigate, Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import edveraLogo from "@/assets/edvera_logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  onSettingsClick: () => void;
}

export function AppHeader({ onSettingsClick }: AppHeaderProps) {
  const { t } = useLanguage();
  const { user } = useSession();
  const { isGuest, exitGuestMode } = useGuestMode();
  const { selectedChild, children, setSelectedChildId, school } = useSelectedChild();
  const { isAuthorized: hasStaffAccess } = useAdminMembership();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    if (isGuest) {
      exitGuestMode();
      navigate("/");
      return;
    }
    await signOut();
    navigate("/");
  };

  const isAuthenticated = !!user && !isGuest;

  const initials = isAuthenticated
    ? user?.user_metadata?.full_name
      ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
      : user?.email?.[0]?.toUpperCase() ?? "?"
    : null;

  const displayChildName = selectedChild?.display_name ?? "No child";

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Left: Logo lockup */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          aria-label="Go to home"
        >
          <img
            src={edveraLogo}
            alt="Edvera"
            className="h-10 w-auto object-contain mix-blend-multiply translate-y-0.5"
          />
        </Link>

        {isGuest && !user && (
          <p className="text-xs text-muted-foreground ml-1 shrink-0">Guest</p>
        )}

        {/* School name (derived from active child, non-clickable) */}
        {school && (
          <span className="text-xs text-muted-foreground truncate max-w-[100px] ml-1 translate-y-[4.4px]">
            {school.name}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: child toggle + settings + profile */}
        <div className="flex items-end gap-1.5">

          {/* Child Switcher */}
          {children.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors text-sm"
                  aria-label="Switch child"
                >
                  <Users className="w-4 h-4" />
                  {!isMobile && (
                    <span className="text-xs max-w-[60px] truncate">{displayChildName}</span>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-popover border border-border shadow-md z-50">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch Profile
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {children.map((child) => (
                  <DropdownMenuItem
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className="cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium">{child.display_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {child.grade_level === "K" ? "K" : `Gr ${child.grade_level}`}
                      </span>
                    </div>
                    {selectedChild?.id === child.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/children")}
                  className="cursor-pointer text-primary"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Profiles
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => navigate("/children")}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors text-sm"
              aria-label="Add child"
            >
              <span className="text-xs">Add Profile</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          )}

          {/* Settings */}
          <button
            onClick={onSettingsClick}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors translate-y-[1px]"
            aria-label="Open settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 -translate-y-[2.4px]"
                aria-label="Account menu"
              >
                {isGuest ? <User className="w-3.5 h-3.5" /> : initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-md z-50">
              <DropdownMenuLabel className="text-xs text-muted-foreground truncate">
                {isGuest ? "Guest" : (user?.email ?? "Account")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/children")} className="cursor-pointer">
                <Users className="w-4 h-4 mr-2" />
                My Profiles
              </DropdownMenuItem>
              {hasStaffAccess && (
                <DropdownMenuItem
                  onClick={() => {
                    setAuthMode("staff");
                    navigate("/admin");
                  }}
                  className="cursor-pointer"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Staff Portal
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                {isGuest ? "Exit guest mode" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
