import { useMemo } from "react";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import { Badge } from "@/components/ui/badge";
import { differenceInMinutes, format } from "date-fns";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  items: TriageItem[];
  lastUpdated: Date;
}

const METRICS = [
  { key: "new", label: "New", className: "bg-destructive/10 text-destructive border-destructive/20" },
  { key: "needs_info", label: "Needs Info", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  { key: "in_review", label: "In Review", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  { key: "escalated", label: "Escalated", className: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]" },
];

export function MorningSnapshot({ items, lastUpdated }: Props) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    METRICS.forEach((m) => (map[m.key] = 0));
    items.forEach((i) => {
      if (map[i.triage_status] !== undefined) map[i.triage_status]++;
    });
    return map;
  }, [items]);

  const pendingOver30 = useMemo(() => {
    const now = new Date();
    return items.filter(
      (i) => i.triage_status === "new" && differenceInMinutes(now, new Date(i.created_at)) >= 30
    ).length;
  }, [items]);

  return (
    <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-card px-4 py-3">
      {METRICS.map((m) => (
        <div
          key={m.key}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${m.className}`}
        >
          <span>{m.label}</span>
          <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
            {counts[m.key] ?? 0}
          </Badge>
        </div>
      ))}

      {pendingOver30 > 0 && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-destructive/10 text-destructive border-destructive/20">
          <AlertTriangle className="w-3 h-3" />
          <span>Pending &gt;30m</span>
          <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
            {pendingOver30}
          </Badge>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="w-3 h-3" />
        Updated {format(lastUpdated, "h:mm:ss a")}
      </div>
    </div>
  );
}
