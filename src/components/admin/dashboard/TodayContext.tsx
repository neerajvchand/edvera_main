import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import type { SchoolRiskSummary } from "@/hooks/useSchoolRiskSummary";

interface Props {
  triageItems: TriageItem[];
  riskSummary: SchoolRiskSummary;
}

function getToday(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export function TodayContext({ triageItems, riskSummary }: Props) {
  const today = getToday();
  const todayItems = triageItems.filter((t) => t.attendance_date === today);

  const unresolvedStatuses = ["new", "in_review", "needs_info"];
  const resolvedStatuses = ["resolved", "accepted", "corrected", "rejected"];

  // Global unresolved count (all dates)
  const totalUnresolved = triageItems.filter((t) => unresolvedStatuses.includes(t.triage_status)).length;

  // Stat 1: Today's Volume
  const todayCount = todayItems.length;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = triageItems.filter(
    (t) => new Date(t.attendance_date) >= thirtyDaysAgo
  ).length;
  const dailyAvg = Math.round((recentCount / 30) * 10) / 10;
  const volumeColor =
    todayCount === 0
      ? "text-emerald-600"
      : dailyAvg > 0 && todayCount > dailyAvg * 1.5
        ? "text-destructive"
        : "text-foreground";
  const volumeBorder =
    todayCount === 0
      ? "border-l-emerald-500"
      : dailyAvg > 0 && todayCount > dailyAvg * 1.5
        ? "border-l-destructive"
        : "border-l-border";

  // Stat 2: Resolved Today
  const resolvedToday = todayItems.filter((t) => resolvedStatuses.includes(t.triage_status)).length;
  const resolvedColor =
    todayCount === 0
      ? "text-muted-foreground"
      : resolvedToday === todayCount
        ? "text-emerald-600"
        : resolvedToday === 0
          ? "text-destructive"
          : "text-foreground";
  const resolvedBorder =
    todayCount === 0
      ? "border-l-border"
      : resolvedToday === todayCount
        ? "border-l-emerald-500"
        : resolvedToday === 0
          ? "border-l-destructive"
          : "border-l-border";

  // Stat 3: Avg Response (all time)
  const resolvedItems = triageItems.filter(
    (t) => resolvedStatuses.includes(t.triage_status) && t.resolved_at
  );
  const avgMin = (() => {
    if (resolvedItems.length === 0) return null;
    const total = resolvedItems.reduce(
      (s, t) => s + differenceInMinutes(new Date(t.resolved_at!), new Date(t.created_at)),
      0
    );
    return Math.round(total / resolvedItems.length);
  })();
  const formatAge = (m: number) => {
    if (m < 60) return `${m}m`;
    if (m < 1440) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
    }
    return `${Math.floor(m / 1440)}d`;
  };
  const avgColor =
    avgMin === null
      ? "text-muted-foreground"
      : avgMin < 30
        ? "text-emerald-600"
        : avgMin <= 120
          ? "text-foreground"
          : avgMin <= 480
            ? "text-orange-500"
            : "text-destructive";
  const avgBorder =
    avgMin === null
      ? "border-l-border"
      : avgMin < 30
        ? "border-l-emerald-500"
        : avgMin <= 120
          ? "border-l-border"
          : avgMin <= 480
            ? "border-l-orange-400"
            : "border-l-destructive";

  // Stat 4: At Risk
  const atRiskCount = riskSummary.elevated.length + riskSummary.softening.length;
  const riskColor =
    atRiskCount === 0
      ? "text-emerald-600"
      : atRiskCount <= 2
        ? "text-orange-500"
        : "text-destructive";
  const riskBorder =
    atRiskCount === 0
      ? "border-l-emerald-500"
      : atRiskCount <= 2
        ? "border-l-orange-400"
        : "border-l-destructive";

  return (
    <Card className="border rounded-xl bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-sm font-semibold text-foreground">
          Today — {format(new Date(), "EEEE, MMMM d")}
        </p>
        <div className="flex items-center gap-1.5">
          {totalUnresolved > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse inline-block" />
              <span className="text-sm text-destructive font-medium">{totalUnresolved} unresolved</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-sm text-emerald-600 font-medium">All clear</span>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 pb-4">
        {/* Today's Volume */}
        <div className={cn("border-l-2 pl-3", volumeBorder)}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Today's Volume</p>
          <p className={cn("text-2xl font-bold tabular-nums", volumeColor)}>{todayCount}</p>
          <p className="text-xs text-muted-foreground">avg {dailyAvg}/day</p>
        </div>

        {/* Resolved Today */}
        <div className={cn("border-l-2 pl-3", resolvedBorder)}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Resolved Today</p>
          <p className={cn("text-2xl font-bold tabular-nums", resolvedColor)}>{resolvedToday}</p>
          <p className="text-xs text-muted-foreground">
            {todayCount > 0 ? `of ${todayCount} reported` : "no reports"}
          </p>
        </div>

        {/* Avg Response */}
        <div className={cn("border-l-2 pl-3", avgBorder)}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Avg Response</p>
          <p className={cn("text-2xl font-bold tabular-nums", avgColor)}>
            {avgMin !== null ? formatAge(avgMin) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">all time</p>
        </div>

        {/* At Risk */}
        <div className={cn("border-l-2 pl-3", riskBorder)}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">At Risk</p>
          <p className={cn("text-2xl font-bold tabular-nums flex items-center gap-1.5", riskColor)}>
            {atRiskCount}
            {atRiskCount === 0 && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          </p>
          <p className="text-xs text-muted-foreground">of {riskSummary.totalStudents} students</p>
        </div>
      </div>
    </Card>
  );
}
