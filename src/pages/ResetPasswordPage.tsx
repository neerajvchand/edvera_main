import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authDebug, hasRecoveryParams } from "@/lib/authRedirect";
import edveraLogo from "@/assets/edvera_logo.png";

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean>(() => hasRecoveryParams());

  useEffect(() => {
    authDebug("reset-password:mount", { readyFromUrl: hasRecoveryParams() });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authDebug("reset-password:auth-event", { event, hasSession: !!session });
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && hasRecoveryParams()) {
        authDebug("reset-password:session-ready", { userId: session.user.id });
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      authDebug("reset-password:update-error", { message: error.message });
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } else {
      authDebug("reset-password:update-success");
      toast({ title: "Password updated! 🎉", description: "You're all set — redirecting you now." });
      setTimeout(() => navigate("/post-login", { replace: true }), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-6">
      <div className="w-full max-w-sm mt-[15vh] space-y-6">
        <div className="text-center space-y-2">
          <img src={edveraLogo} alt="Edvera" className="h-8 w-auto mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="text-muted-foreground text-sm">
            {ready ? "Enter your new password below." : "Verifying your reset link…"}
          </p>
        </div>

        {ready && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button onClick={handleReset} size="lg" className="w-full text-base" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
