import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, School, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useChildren } from "@/hooks/useChildren";
import { useProfile } from "@/hooks/useProfile";
import { useSchool } from "@/hooks/useSchool";
import { supabase } from "@/integrations/supabase/client";
import edveraLogo from "@/assets/edvera_logo.png";

const BAYSIDE_ID = "a1b2c3d4-0001-4000-8000-000000000001";

const GRADES = [
  { value: "prefer-not-to-say", label: "Prefer not to say" },
  { value: "K", label: "Kindergarten" },
  { value: "1", label: "Grade 1" },
  { value: "2", label: "Grade 2" },
  { value: "3", label: "Grade 3" },
  { value: "4", label: "Grade 4" },
  { value: "5", label: "Grade 5" },
  { value: "6", label: "Grade 6" },
  { value: "7", label: "Grade 7" },
  { value: "8", label: "Grade 8" },
];

const NICKNAME_SUGGESTIONS = [
  "Little Sharky",
  "Chipmunk",
  "Super Reader",
  "Rocket",
  "Sunshine",
  "Captain Curious",
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addChild, isAdding } = useChildren();
  const { setOnboardingComplete } = useProfile();
  const { data: schoolData } = useSchool(BAYSIDE_ID);

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(() => Math.floor(Math.random() * NICKNAME_SUGGESTIONS.length));

  // Rotate placeholder every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % NICKNAME_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const schoolDistrictId = (schoolData as any)?.district_id as string | null;
  const schoolDistrictLabel = (schoolData as any)?.district_name as string | null;
  const needsDistrict = schoolData && !schoolDistrictId;

  // Pre-fill district
  useState(() => {
    if (needsDistrict && schoolDistrictLabel && !districtName) {
      setDistrictName(schoolDistrictLabel);
    }
  });

  const isValid = name.trim().length >= 2;

  const handleCreate = useCallback(async () => {
    if (!isValid || isAdding) return;
    try {
      let districtId = schoolDistrictId || undefined;

      if (!schoolDistrictId && districtName.trim()) {
        const { data: newDistrictId, error: dErr } = await supabase
          .rpc("link_school_district" as any, {
            p_school_id: BAYSIDE_ID,
            p_district_name: districtName.trim(),
          });
        if (!dErr && newDistrictId) {
          districtId = newDistrictId as string;
        }
      }

      await addChild({
        display_name: name.trim(),
        grade_level: grade === "prefer-not-to-say" ? "" : grade,
        school_id: BAYSIDE_ID,
        district_id: districtId || null,
      });

      try { await setOnboardingComplete(); } catch { /* best effort */ }

      // Show confirmation briefly
      setConfirmed(true);
      setTimeout(() => {
        navigate("/children");
      }, 1500);
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  }, [isValid, isAdding, name, grade, districtName, schoolDistrictId, addChild, setOnboardingComplete, navigate, toast]);

  // --- Confirmation state ---
  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="animate-fade-in text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <p className="text-xl font-semibold text-foreground">You're set.</p>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  // --- Onboarding form ---
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-20 overflow-hidden flex items-center">
              <img src={edveraLogo} alt="Edvera" className="h-32 w-auto object-contain mix-blend-multiply" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-foreground">Welcome to Edvera</h1>
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              School, without the noise.
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A calmer, clearer way to manage your child's school day.
          </p>
        </div>

        {/* Profile creation card */}
        <Card className="shadow-lg border-border/60">
          <CardContent className="pt-6 pb-6 space-y-5">
            <p className="text-xs text-muted-foreground text-center">
              Let's set up your profile in under a minute.
            </p>

            {/* Nickname */}
            <div className="space-y-1.5">
              <Label htmlFor="ob-nickname" className="text-sm font-medium">
                Child name <span className="font-normal text-muted-foreground">(nickname works)</span>
              </Label>
              <Input
                id="ob-nickname"
                placeholder={NICKNAME_SUGGESTIONS[placeholderIdx]}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base"
                onKeyDown={(e) => e.key === "Enter" && isValid && handleCreate()}
              />
              <p className="text-xs text-muted-foreground">
                Use a nickname if you'd like — real names aren't required.
              </p>
              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {NICKNAME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setName(suggestion)}
                    className="px-2.5 py-1 text-xs rounded-full border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {name.length > 0 && name.trim().length < 2 && (
                <p className="text-xs text-destructive">At least 2 characters needed</p>
              )}
            </div>

            {/* Grade */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Grade (optional)</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-md z-50">
                  {GRADES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used only to improve relevance later.</p>
            </div>

            {/* School (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">School</Label>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <School className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Bayside Academy</p>
                  <p className="text-xs text-muted-foreground">San Mateo–Foster City School District</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Currently supported school for this preview.</p>
            </div>

            {/* District (conditional) */}
            {needsDistrict && (
              <div className="space-y-1.5">
                <Label htmlFor="ob-district" className="text-sm font-medium">District</Label>
                <Input
                  id="ob-district"
                  placeholder="e.g. San Mateo–Foster City School District"
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">Helps group schools for Board Briefs later.</p>
              </div>
            )}

            {/* Privacy block */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Private by default</p>
                <p className="text-xs text-muted-foreground">Your data is encrypted and never sold.</p>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={handleCreate}
              disabled={!isValid || isAdding}
              className="w-full"
              size="lg"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Create my profile"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
