import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { getAuthMode, getDefaultView, setDefaultView } from "@/lib/authMode";
import { authDebug, hasAuthCallbackParams } from "@/lib/authRedirect";
import { Button } from "@/components/ui/button";
import { GraduationCap, Shield } from "lucide-react";
import { useState } from "react";

/**
 * Mounted ONLY on /post-login route. Runs once after auth callback
 * to decide where to send the user. Does NOT run globally.
 */
export function PostLoginRouter() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { isAuthorized: hasStaff, isLoading: staffLoading } = useAdminMembership();
  const [hasCallbackParams] = useState<boolean>(() => hasAuthCallbackParams());
  const [callbackSettled, setCallbackSettled] = useState<boolean>(() => !hasCallbackParams);
  const [showPicker, setShowPicker] = useState(false);

  const loading = sessionLoading || staffLoading || !callbackSettled;

  useEffect(() => {
    if (!hasCallbackParams || callbackSettled) return;
    const timer = window.setTimeout(() => {
      authDebug("post-login:callback-timeout");
      if (!user) {
        navigate("/", { replace: true });
      }
      setCallbackSettled(true);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [hasCallbackParams, callbackSettled, user, navigate]);

  useEffect(() => {
    if (user && !callbackSettled) {
      authDebug("post-login:callback-resolved", { userId: user.id });
      setCallbackSettled(true);
    }
  }, [user, callbackSettled]);

  useEffect(() => {
    if (loading) return;

    // Not logged in — back to home (which will show sign-in via AuthGate)
    if (!user) {
      authDebug("post-login:no-user-redirect-home");
      navigate("/", { replace: true });
      return;
    }

    const mode = getAuthMode();
    const defaultView = getDefaultView();
    authDebug("post-login:decision", { mode, defaultView, hasStaff });

    // User picked Staff mode on sign-in screen
    if (mode === "staff") {
      if (hasStaff) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/staff-access", { replace: true });
      }
      return;
    }

    // Parent mode — but user also has staff access and no saved default
    if (hasStaff && !defaultView) {
      setShowPicker(true);
      return;
    }

    // Has a saved default of staff
    if (defaultView === "staff" && hasStaff) {
      navigate("/admin", { replace: true });
      return;
    }

    // Default: parent view
    navigate("/", { replace: true });
  }, [loading, user, hasStaff, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Setting things up…</p>
      </div>
    );
  }

  if (showPicker) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-sm text-muted-foreground">
            You have both parent and staff access. Where would you like to go?
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-6"
              onClick={() => {
                setDefaultView("parent");
                navigate("/", { replace: true });
              }}
            >
              <GraduationCap className="w-6 h-6" />
              <span className="font-semibold">Parent View</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-6"
              onClick={() => {
                setDefaultView("staff");
                navigate("/admin", { replace: true });
              }}
            >
              <Shield className="w-6 h-6" />
              <span className="font-semibold">Staff Portal</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            You can switch anytime from the header menu.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
