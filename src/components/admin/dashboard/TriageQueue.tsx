import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle,
  HelpCircle,
  XCircle,
  ArrowRight,
  MoreHorizontal,
} from "lucide-react";
import { differenceInMinutes, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { TriageItem } from "@/hooks/useAttendanceTriage";

interface TriageQueueProps {
  items: TriageItem[];
  updateTriage: (args: { id: string; triage_status: string; admin_note?: string }) => Promise<void>;
  isUpdating: boolean;
}

const TYPE_BADGE: Record<string, string> = {
  tardy: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]",
  late: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  early: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]",
};

const TRIAGE_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-destructive/15 text-destructive border-destructive/30" },
  in_review: { label: "In Review", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  needs_info: { label: "Needs Info", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
};

function getTypeBadgeClass(status: string) {
  const s = status.toLowerCase();
  for (const [key, cls] of Object.entries(TYPE_BADGE)) {
    if (s.includes(key)) return cls;
  }
  return "bg-secondary text-secondary-foreground border-border";
}

function getLeftBarColor(item: TriageItem): string {
  if (item.triage_status === "needs_info") return "bg-[hsl(var(--status-caution-text))]";
  if (item.triage_status === "in_review") return "bg-[hsl(var(--status-info-text))]";
  const age = differenceInMinutes(new Date(), new Date(item.created_at));
  return age >= 30 ? "bg-destructive" : "bg-[hsl(var(--status-warning-text))]";
}

const MAX_VISIBLE = 5;

export function TriageQueue({ items, updateTriage, isUpdating }: TriageQueueProps) {
  const unresolvedStatuses = ["new", "in_review", "needs_info"];
  const unresolved = items.filter((t) => unresolvedStatuses.includes(t.triage_status));
  const visible = unresolved.slice(0, MAX_VISIBLE);
  const overflow = unresolved.length - MAX_VISIBLE;

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Attendance Queue
            {unresolved.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unresolved.length}
              </Badge>
            )}
          </CardTitle>
          <Link
            to="/admin/attendance-triage"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View Full Queue <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {unresolved.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle className="w-10 h-10 text-[hsl(var(--status-success-text))] mx-auto mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground">All clear — no pending items</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {visible.map((item) => {
              const triageBadge = TRIAGE_BADGE[item.triage_status] ?? TRIAGE_BADGE.new;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors group"
                >
                  {/* Left color bar */}
                  <div className={cn("w-1 h-10 rounded-full shrink-0", getLeftBarColor(item))} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {item.child_name}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] border h-5", getTypeBadgeClass(item.submitted_status))}>
                        {item.submitted_status}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] border h-5", triageBadge.className)}>
                        {triageBadge.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {item.submitted_reason && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.submitted_reason}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2.5 bg-[hsl(var(--status-success-text))] hover:bg-[hsl(var(--status-success-text))]/90 text-white"
                      onClick={() => updateTriage({ id: item.id, triage_status: "resolved" })}
                      disabled={isUpdating}
                    >
                      <CheckCircle className="w-3 h-3" /> Accept
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => updateTriage({ id: item.id, triage_status: "needs_info" })}>
                          <HelpCircle className="w-3.5 h-3.5 mr-2" /> Needs Info
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => updateTriage({ id: item.id, triage_status: "rejected" })}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}

            {overflow > 0 && (
              <div className="pt-2 text-center">
                <Link
                  to="/admin/attendance-triage"
                  className="text-xs text-primary hover:underline"
                >
                  and {overflow} more →
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
