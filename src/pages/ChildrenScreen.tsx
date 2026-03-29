import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, School, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useChildren } from "@/hooks/useChildren";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useSchool } from "@/hooks/useSchool";
import { supabase } from "@/integrations/supabase/client";

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

function AddProfileForm({ onAdded }: { onAdded: () => void }) {
  const { toast } = useToast();
  const { addChild, isAdding } = useChildren();
  const { data: schoolData } = useSchool(BAYSIDE_ID);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(() => Math.floor(Math.random() * NICKNAME_SUGGESTIONS.length));

  // Rotate placeholder every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % NICKNAME_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Pre-fill district name from school's district_name if no district_id
  const schoolDistrictId = (schoolData as any)?.district_id as string | null;
  const schoolDistrictLabel = (schoolData as any)?.district_name as string | null;

  // Show district field only when school has no district_id
  const needsDistrict = schoolData && !schoolDistrictId;

  useEffect(() => {
    if (needsDistrict && schoolDistrictLabel && !districtName) {
      setDistrictName(schoolDistrictLabel);
    }
  }, [needsDistrict, schoolDistrictLabel]);

  const isValid = name.trim().length >= 2;

  const handleAdd = async () => {
    if (!isValid) return;
    try {
      let districtId = schoolDistrictId || undefined;

      // Create district on-the-fly if school lacks one and user provided a name
      if (!schoolDistrictId && districtName.trim()) {
        const { data: newDistrictId, error: dErr } = await supabase
          .rpc("link_school_district" as any, {
            p_school_id: BAYSIDE_ID,
            p_district_name: districtName.trim(),
          });

        if (dErr) {
          console.error("Failed to create district:", dErr);
        } else if (newDistrictId) {
          districtId = newDistrictId as string;
        }
      }

      await addChild({
        display_name: name.trim(),
        grade_level: grade === "prefer-not-to-say" ? "" : grade,
        school_id: BAYSIDE_ID,
        district_id: districtId || null,
      });
      setName("");
      setGrade("");
      setDistrictName("");
      toast({
        title: "Profile created",
        description: `${name.trim()} has been added successfully.`,
      });
      onAdded();
    } catch (err: any) {
      console.error("Failed to create profile:", err);
      toast({
        title: "Something went wrong",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Nickname field */}
      <div className="space-y-1.5">
        <Label htmlFor="nickname" className="text-sm font-medium">
          Child name <span className="font-normal text-muted-foreground">(nickname works)</span>
        </Label>
        <Input
          id="nickname"
          placeholder={NICKNAME_SUGGESTIONS[placeholderIdx]}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-base"
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
          <p className="text-xs text-destructive">
            At least 2 characters needed
          </p>
        )}
      </div>

      {/* Grade field */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Grade (optional)</Label>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger>
            <SelectValue placeholder="Select grade" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-md z-50">
            {GRADES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Used only to improve relevance later.
        </p>
      </div>

      {/* School (read-only) */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">School</Label>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <School className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Bayside Academy
            </p>
            <p className="text-xs text-muted-foreground">
              San Mateo–Foster City School District
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Currently supported school for this preview.
        </p>
      </div>

      {/* District field (only when school lacks district_id) */}
      {needsDistrict && (
        <div className="space-y-1.5">
          <Label htmlFor="district" className="text-sm font-medium">
            District
          </Label>
          <Input
            id="district"
            placeholder="e.g. San Mateo–Foster City School District"
            value={districtName}
            onChange={(e) => setDistrictName(e.target.value)}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Helps group schools for Board Briefs later.
          </p>
        </div>
      )}

      {/* Privacy block */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
        <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Private by default
          </p>
          <p className="text-xs text-muted-foreground">
            Your data is encrypted and never sold.
          </p>
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={handleAdd}
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
          "Save Profile"
        )}
      </Button>
    </div>
  );
}

function ProfileList() {
  const { toast } = useToast();
  const { children, isLoading, removeChild } = useChildren();

  const handleRemove = async (id: string, displayName: string) => {
    try {
      await removeChild(id);
      toast({
        title: "Profile removed",
        description: `${displayName} has been removed.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to remove profile",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (children.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Your Profiles
        </h3>
        <div className="space-y-2.5">
          {children.map((child) => (
            <div
              key={child.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
            >
              <div className="space-y-0.5">
                <p className="font-medium text-sm text-foreground">
                  {child.display_name}
                </p>
                {child.grade_level && child.grade_level !== "" && (
                  <Badge variant="secondary" className="text-xs">
                    {child.grade_level === "K"
                      ? "Kindergarten"
                      : `Grade ${child.grade_level}`}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(child.id, child.display_name)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChildrenScreen() {
  const navigate = useNavigate();
  const { children, isAuthenticated } = useChildren();
  const { enterGuestMode } = useGuestMode();

  const isOnboarding = children.length === 0;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <p className="text-muted-foreground">
          Please sign in to manage your profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-foreground">
            {isOnboarding ? "Personalize Your Dashboard" : "Manage Profiles"}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 pt-20 pb-8 space-y-5">
        {/* Onboarding intro */}
        {isOnboarding && (
          <div className="text-center space-y-1 pb-1">
            <p className="text-muted-foreground text-sm">
              Add a nickname to tailor your view.
              <br />
              Real names are not required.
            </p>
          </div>
        )}

        {/* Add profile form */}
        <Card>
          <CardContent className="pt-5 pb-5">
            {!isOnboarding && (
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Add Profile
              </h3>
            )}
            <AddProfileForm onAdded={() => {}} />
          </CardContent>
        </Card>

        {/* Explore Demo CTA (onboarding only) */}
        {isOnboarding && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              enterGuestMode();
              navigate("/");
            }}
          >
            Explore Demo Instead
          </Button>
        )}

        {/* Existing profiles list */}
        <ProfileList />
      </div>
    </div>
  );
}
