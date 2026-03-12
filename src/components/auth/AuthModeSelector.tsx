import { GraduationCap, Shield } from "lucide-react";
import type { AuthMode } from "@/lib/authMode";

interface AuthModeSelectorProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export function AuthModeSelector({ mode, onChange }: AuthModeSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wider">
        I'm signing in as…
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange("parent")}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
            mode === "parent"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-muted-foreground/30"
          }`}
        >
          <GraduationCap className={`w-5 h-5 ${mode === "parent" ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`text-sm font-semibold ${mode === "parent" ? "text-foreground" : "text-muted-foreground"}`}>
            Parent
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight">
            See your child's day, without&nbsp;the&nbsp;noise.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange("staff")}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
            mode === "staff"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-muted-foreground/30"
          }`}
        >
          <Shield className={`w-5 h-5 ${mode === "staff" ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`text-sm font-semibold ${mode === "staff" ? "text-foreground" : "text-muted-foreground"}`}>
            Staff
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight">
            Manage school updates &amp;&nbsp;attendance.
          </span>
        </button>
      </div>
      {mode === "staff" && (
        <p className="text-[10px] text-muted-foreground text-center">
          Staff access requires an invitation from your school&nbsp;/&nbsp;district.
        </p>
      )}
    </div>
  );
}
