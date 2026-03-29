import { useSession } from "@/hooks/useSession";
import { signOut } from "@/lib/auth";
import { setAuthMode } from "@/lib/authMode";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function StaffAccessPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const handleGoParent = () => {
    setAuthMode("parent");
    navigate("/", { replace: true });
  };

  const handleTryDifferent = async () => {
    // Keep staff mode so they land back on staff login
    setAuthMode("staff");
    await signOut();
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
        <h1 className="text-xl font-semibold text-foreground">Staff access not found</h1>
        {user?.email && (
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          This account isn't linked to a school staff membership yet. Ask your school administrator to send you an invitation.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleGoParent} className="w-full">
            Go to Parent View
          </Button>
          <Button onClick={handleTryDifferent} variant="outline" className="w-full">
            Try a different account
          </Button>
        </div>
      </div>
    </div>
  );
}
