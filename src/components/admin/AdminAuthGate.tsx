import { useSession } from "@/hooks/useSession";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { Navigate } from "react-router-dom";

interface AdminAuthGateProps {
  children: React.ReactNode;
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const { session, loading: sessionLoading } = useSession();
  const { isAuthorized, isLoading: membershipLoading } = useAdminMembership();

  // CRITICAL: Show loading until BOTH session and membership are resolved
  if (sessionLoading || membershipLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!isAuthorized) {
    return <Navigate to="/staff-access" replace />;
  }

  return <>{children}</>;
}
