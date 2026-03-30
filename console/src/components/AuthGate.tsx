import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { useMembership } from "@/context/MembershipContext";

const NO_MEMBERSHIP_MESSAGE =
  "Your account is not linked to a school. Contact your district administrator.";

const MEMBERSHIP_LOAD_ERROR_MESSAGE =
  "Unable to verify your school access. Please try signing in again.";

export function AuthGate() {
  const { session, loading: sessionLoading } = useSession();
  const {
    isLoading: membershipLoading,
    role,
    error: membershipError,
  } = useMembership();

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (membershipError) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ membershipError: MEMBERSHIP_LOAD_ERROR_MESSAGE }}
      />
    );
  }

  if (!role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ membershipError: NO_MEMBERSHIP_MESSAGE }}
      />
    );
  }

  return <Outlet />;
}
