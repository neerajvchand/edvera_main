import { Card, CardContent } from "@/components/ui/card";
import { format, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import type { TriageItem } from "@/hooks/useAttendanceTriage";

interface TodayPulseProps {
  items: TriageItem[];
  todayStr: string;
}

export function TodayPulse({ items, todayStr }: TodayPulseProps) {
  const todayItems = items.filter((t) => t.attendance_date === todayStr);
  const unresolvedStatuses = ["new", "in_review", "needs_info"];
  const resolvedStatuses = ["resolved", "accepted", "corrected", "rejected"];

  const reported = todayItems.length;
  const unresolved = todayItems.filter((t) => unresolvedStatuses.includes(t.triage_status)).length;
  const resolved = todayItems.filter((t) => resolvedStatuses.includes(t.triage_status)).length;

  const avgResponse = (() => {
    const r = todayItems.filter((t) => resolvedStatuses.includes(t.triage_status) && t.resolved_at);
    if (r.length === 0) return null;
    const total = r.reduce((s, t) => s + differenceInMinutes(new Date(t.resolved_at!), new Date(t.created_at)), 0);
    return Math.round(total / r.length);
  })();

  // Oldest unresolved
  const unresolvedItems = todayItems.filter((t) => unresolvedStatuses.includes(t.triage_status));
  const oldestAge = (() => {
    if (unresolvedItems.length === 0) return 0;
    const oldest = unresolvedItems.reduce((a, b) => (new Date(a.created_at) < new Date(b.created_at) ? a : b));
    return differenceInMinutes(new Date(), new Date(oldest.created_at));
  })();

  const ageIndicator = (() => {
    if (unresolved === 0) return { color: "bg-[hsl(var(--status-success-text))]", label: "All clear", pulse: false };
    if (oldestAge < 30) return { color: "bg-[hsl(var(--status-warning-text))]", label: `Oldest: ${oldestAge}m`, pulse: false };
    if (oldestAge < 60) return { color: "bg-[hsl(var(--status-caution-text))]", label: `Oldest: ${oldestAge}m`, pulse: false };
    const h = Math.floor(oldestAge / 60);
    const m = oldestAge % 60;
    return { color: "bg-destructive", label: `Oldest: ${h}h ${m}m`, pulse: true };
  })();

  const metrics = [
    { value: reported, label: "Reported", border: "border-l-[hsl(var(--status-info-border))]" },
    { value: unresolved, label: "Unresolved", border: "border-l-destructive" },
    { value: resolved, label: "Resolved", border: "border-l-[hsl(var(--status-success-border))]" },
    { value: avgResponse !== null ? `${avgResponse}m` : "—", label: "Avg Response", border: "border-l-[hsl(var(--status-warning-border))]" },
  ];

  return (
    <Card className="border bg-card rounded-xl shadow-sm">
      <CardContent className="px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Left: date */}
          <div className="shrink-0">
            <p className="text-sm font-semibold text-foreground">
              Today — {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>

          {/* Center: metrics */}
          <div className="flex flex-wrap items-center gap-4 flex-1 justify-center">
            {metrics.map((m) => (
              <div key={m.label} className={cn("border-l-2 pl-3", m.border)}>
                <p className="text-2xl font-bold text-foreground tabular-nums">{m.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Right: age indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("w-2.5 h-2.5 rounded-full", ageIndicator.color, ageIndicator.pulse && "animate-pulse")} />
            <span className="text-sm font-medium text-foreground">{ageIndicator.label}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
