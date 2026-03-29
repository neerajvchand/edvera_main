import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGuestMode } from "@/hooks/useGuestMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthModeSelector } from "./AuthModeSelector";
import { getAuthMode, setAuthMode, type AuthMode as AppAuthMode } from "@/lib/authMode";
import { authDebug, buildAuthRedirect } from "@/lib/authRedirect";
import edveraLogo from "@/assets/edvera_logo.png";

type Mode = "welcome" | "signin" | "signup" | "forgot";

export function SignInScreen() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { enterGuestMode } = useGuestMode();
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthModeLocal] = useState<AppAuthMode>(getAuthMode);

  const handleModeChange = (m: AppAuthMode) => {
    setAuthModeLocal(m);
    setAuthMode(m);
  };

  const handleGoogleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthRedirect("/post-login"),
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      authDebug("oauth:error", { provider: "google", message: error.message });
      const providerNotEnabled =
        /unsupported provider/i.test(error.message) ||
        /provider is not enabled/i.test(error.message);
      toast({
        title: providerNotEnabled ? "Google sign-in is not enabled" : "Sign-in failed",
        description: providerNotEnabled
          ? "Enable Google provider in Supabase Auth settings, then add Google OAuth client ID/secret."
          : error instanceof Error
            ? error.message
            : "Could not connect to Google. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
      return;
    }

    toast({
      title: "Sign-in failed",
      description: "No OAuth redirect URL was returned. Please try again.",
      variant: "destructive",
    });
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      authDebug("email-signin:error", { message: error.message });
      toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
    } else {
      authDebug("email-signin:success", { hasSession: !!data.session, userId: data.user?.id ?? null });
      navigate("/post-login", { replace: true });
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !fullName) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthRedirect("/post-login"),
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      authDebug("signup:error", { message: error.message });
      toast({ title: "Sign-up failed", description: error.message, variant: "destructive" });
    } else {
      authDebug("signup:success");
      toast({
        title: "You're almost there! 🎉",
        description: "Check your email for a confirmation link, then come back and sign in.",
      });
      setMode("signin");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Enter your email first", description: "We need your email to send a reset link.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthRedirect("/reset-password"),
    });
    setLoading(false);
    if (error) {
      authDebug("password-reset-email:error", { message: error.message });
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
    } else {
      authDebug("password-reset-email:sent");
      toast({ title: "Check your inbox 📬", description: "We sent a password reset link to your email." });
      setMode("signin");
    }
  };

  if (mode === "welcome") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center px-6">
        <div className="w-full max-w-sm text-center mt-[14vh] space-y-6">
          <div className="flex flex-col items-center gap-1">
            <div className="h-24 overflow-hidden flex items-center">
              <img src={edveraLogo} alt="Edvera" className="h-40 w-auto object-contain mix-blend-multiply" />
            </div>
            <p className="text-muted-foreground text-sm font-bold tracking-[0.2em] uppercase">School, without the noise.</p>
          </div>

          <AuthModeSelector mode={authMode} onChange={handleModeChange} />

          <div className="space-y-3 pt-4">
            <Button onClick={handleGoogleSignIn} size="lg" className="w-full text-base">
              Continue with Google
            </Button>
            <Button onClick={() => setMode("signin")} variant="outline" size="lg" className="w-full text-base">
              Sign in with Email
            </Button>
            {authMode === "parent" && (
              <Button onClick={enterGuestMode} variant="ghost" size="lg" className="w-full text-base text-muted-foreground">
                Continue as Guest
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            New here?{" "}
            <button onClick={() => setMode("signup")} className="text-primary underline underline-offset-2 font-medium">
              Create an account
            </button>{" "}
            — it only takes a minute!
          </p>
        </div>
      </div>
    );
  }

  const isSignUp = mode === "signup";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-6">
      <div className="w-full max-w-sm mt-[15vh] space-y-6">
        <button onClick={() => setMode("welcome")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </button>

        <div className="text-center space-y-2">
          <img src={edveraLogo} alt="Edvera logo" className="h-8 w-auto mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-foreground">
            {isSignUp ? "Welcome aboard! 🎉" : "Welcome back!"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isSignUp
              ? "Edvera transforms school data into clear, meaningful insights."
              : "Great to see you again — let's check in."}
          </p>
        </div>

        <div className="space-y-4">
          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                placeholder="e.g. Alex Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {!isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-primary hover:underline underline-offset-2"
              >
                Forgot password?
              </button>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <Button
            onClick={isSignUp ? handleEmailSignUp : handleEmailSignIn}
            size="lg"
            className="w-full text-base"
            disabled={loading}
          >
            {loading ? "One moment…" : isSignUp ? "Create my account" : "Sign in"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("signin")} className="text-primary underline underline-offset-2 font-medium">
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account yet?{" "}
              <button onClick={() => setMode("signup")} className="text-primary underline underline-offset-2 font-medium">
                Sign up — it's quick!
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
