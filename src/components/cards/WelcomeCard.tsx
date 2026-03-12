import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useSession } from "@/hooks/useSession";
import { useChildren } from "@/hooks/useChildren";
import { toast } from "sonner";

export function WelcomeCard() {
  const { isGuest } = useGuestMode();
  const { user, loading: sessionLoading } = useSession();
  const { profile, isLoading, isOnboardingComplete, updateDisplayName, setOnboardingComplete } = useProfile();
  const { children, isLoading: childrenLoading } = useChildren();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on first render when name step is shown
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Don't render while still resolving
  if (sessionLoading || isLoading || childrenLoading) return null;

  // Hide conditions
  if (isGuest || !user || skipped) return null;

  const childrenCount = children.length;
  const needsName = !profile?.display_name || profile.display_name.trim().length === 0;
  const showWelcome = !isOnboardingComplete || childrenCount === 0;

  if (!showWelcome) return null;

  const trimmed = name.trim();

  // --- Name entry step ---
  if (needsName && !isOnboardingComplete) {
    const handleSave = async () => {
      if (!trimmed || saving) return;
      setSaving(true);
      try {
        await updateDisplayName(trimmed);
        await setOnboardingComplete();
        toast.success("Saved.");
      } catch {
        toast.error("Couldn't save. Please try again.");
        setSaving(false);
        return;
      }
      setSaving(false);
    };

    const handleSkip = async () => {
      try {
        await setOnboardingComplete();
      } catch { /* best effort */ }
      setSkipped(true);
    };

    return (
      <Card className="animate-fade-in border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Welcome to Edvera</h3>
            <p className="text-xs text-muted-foreground mt-0.5">What should we call you? (optional)</p>
          </div>
          <Input
            ref={inputRef}
            placeholder="First name or nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 text-sm"
            disabled={saving}
            onKeyDown={(e) => e.key === "Enter" && trimmed && handleSave()}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!trimmed || saving} onClick={handleSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={handleSkip}>
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- No children step ---
  if (childrenCount === 0) {
    const handleNotNow = async () => {
      try {
        await setOnboardingComplete();
      } catch { /* best effort */ }
      setSkipped(true);
    };

    return (
      <Card className="animate-fade-in border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Get started</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Add a profile to personalize your dashboard.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate("/children")}>
              <UserPlus className="h-4 w-4 mr-1" />
              Add a profile
            </Button>
            <Button size="sm" variant="ghost" onClick={handleNotNow}>
              Not now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
