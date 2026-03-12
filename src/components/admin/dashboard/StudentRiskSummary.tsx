import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, CheckCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { SchoolRiskSummary, StudentRisk } from "@/hooks/useSchoolRiskSummary";

interface Props {
  summary: SchoolRiskSummary;
}

const tiers = [
  { key: "elevated" as const, label: "Elevated", dotClass: "bg-destructive", barClass: "bg-destructive" },
  { key: "softening" as const, label: "Softening", dotClass: "bg-orange-400", barClass: "bg-orange-400" },
  { key: "stable" as const, label: "Stable", dotClass: "bg-emerald-500", barClass: "bg-emerald-500" },
  { key: "pending" as const, label: "Pending", dotClass: "bg-muted-foreground/40", barClass: "bg-muted" },
] as const;

function rateColor(rate: number) {
  if (rate < 85) return "text-destructive font-bold";
  if (rate < 90) return "text-orange-500 font-semibold";
  if (rate < 95) return "text-orange-400";
  return "text-foreground";
}

export function StudentRiskSummary({ summary }: Props) {
  const { elevated, softening, stable, pending, totalStudents, isLoading } = summary;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const buckets = { elevated, softening, stable, pending };
  const needsAttention: StudentRisk[] = [...elevated, ...softening].slice(0, 5);
  const moreCount = elevated.length + softening.length - needsAttention.length;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">Student Risk Summary</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                Based on attendance rates and trends. Elevated = below 90% or 3+ consecutive absences. Softening = 90-95% or trending down.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {totalStudents === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No students enrolled</p>
        ) : (
          <>
            {/* Healthy rate summary */}
            {(() => {
              const healthyPct = Math.round(((stable.length + pending.length) / totalStudents) * 100);
              const pctColor = healthyPct >= 90 ? "text-emerald-600 font-semibold" : healthyPct >= 80 ? "text-orange-500 font-semibold" : "text-destructive font-semibold";
              return (
                <p className="text-sm text-muted-foreground">
                  <span className={pctColor}>{healthyPct}%</span> of students in healthy range
                </p>
              );
            })()}

            {/* Distribution bars */}
            <div className="space-y-2">
              {tiers.map((tier) => {
                const count = buckets[tier.key].length;
                const pct = totalStudents > 0 ? (count / totalStudents) * 100 : 0;
                return (
                  <div key={tier.key} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${tier.dotClass}`} />
                    <span className="w-16 text-muted-foreground">{tier.label}</span>
                    <span className="w-6 text-right font-bold text-foreground">{count}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tier.barClass} transition-all`}
                        style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Needs Attention */}
            {needsAttention.length > 0 ? (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Needs Attention</p>
                {needsAttention.map((s) => (
                  <div key={s.childId} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">{s.displayName}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{s.gradeLevel}</Badge>
                    <span className={`text-xs tabular-nums shrink-0 ${rateColor(s.metrics.attendance_rate)}`}>
                      {s.metrics.attendance_rate.toFixed(0)}%
                    </span>
                    {s.metrics.trend_delta !== 0 && (
                      <span className={`flex items-center gap-0.5 text-[10px] shrink-0 ${s.metrics.trend_delta < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {s.metrics.trend_delta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {Math.abs(s.metrics.trend_delta).toFixed(0)}
                      </span>
                    )}
                    {s.metrics.consecutive_absences >= 2 && (
                      <span className="text-destructive text-[10px] shrink-0">{s.metrics.consecutive_absences} consecutive</span>
                    )}
                  </div>
                ))}
                {moreCount > 0 && (
                  <p className="text-xs text-muted-foreground pt-1 cursor-pointer hover:underline">and {moreCount} more →</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-600">All students in healthy range</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
