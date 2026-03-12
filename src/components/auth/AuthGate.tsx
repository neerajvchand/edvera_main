import { useSession } from "@/hooks/useSession";
import { useGuestMode } from "@/hooks/useGuestMode";
import { SignInScreen } from "./SignInScreen";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate only handles two things:
 * 1. Show sign-in screen if not authenticated and not guest
 * 2. Render children otherwise
 * 
 * It does NOT do any staff/admin routing. That is handled by:
 * - PostLoginRouter (on the /post-login route, right after auth)
 * - AdminAuthGate (guarding /admin/* routes)
 * - Explicit user clicks (Staff Portal link, Parent View link)
 */
export function AuthGate({ children }: AuthGateProps) {
  const { session, loading } = useSession();
  const { isGuest } = useGuestMode();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!session && !isGuest) {
    return <SignInScreen />;
  }

  return <>{children}</>;
}
