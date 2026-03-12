import { useState } from "react";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { CheckCircle, HelpCircle, PenLine, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  item: TriageItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onAction: (id: string, status: string, note?: string) => void;
  isUpdating: boolean;
  onRowClick: () => void;
}

const STATUS_BADGE: Record<string, { label: string; variant: string; className: string }> = {
  new: { label: "New", variant: "destructive", className: "bg-destructive/15 text-destructive border-destructive/30" },
  in_review: { label: "In Review", variant: "secondary", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  needs_info: { label: "Needs Info", variant: "secondary", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  resolved: { label: "Accepted", variant: "default", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  accepted: { label: "Accepted", variant: "default", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  corrected: { label: "Corrected", variant: "default", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  rejected: { label: "Rejected", variant: "outline", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const TYPE_BADGE: Record<string, string> = {
  tardy: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]",
  late: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  early: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]",
};

function getTypeBadgeClass(status: string) {
  const s = status.toLowerCase();
  for (const [key, cls] of Object.entries(TYPE_BADGE)) {
    if (s.includes(key)) return cls;
  }
  return "bg-secondary text-secondary-foreground border-border";
}

const isActionable = (status: string) =>
  ["new", "in_review", "needs_info"].includes(status);

export function TriageCard({ item, isSelected, onToggleSelect, onAction, isUpdating, onRowClick }: Props) {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.admin_note ?? "");
  const mobile = useIsMobile();
  const actionable = isActionable(item.triage_status);
  const badge = STATUS_BADGE[item.triage_status] ?? STATUS_BADGE.new;

  return (
    <Card className={cn(
      "transition-shadow cursor-pointer border-l-4",
      isSelected && "ring-2 ring-primary/40",
      item.triage_status === "new" && item.resolved_at
        ? "border-l-[hsl(var(--status-warning-border))]"
        : "border-l-transparent"
    )} onClick={onRowClick}>
      <CardContent className="p-4">
        <div className={cn("flex gap-3", mobile ? "flex-col" : "items-start")}>
          {/* Checkbox + Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {actionable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="mt-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{item.child_name}</span>
                {item.parent_name && (
                  <span className="text-[10px] text-muted-foreground">({item.parent_name})</span>
                )}
                <Badge variant="outline" className={cn("text-[10px] border", getTypeBadgeClass(item.submitted_status))}>
                  {item.submitted_status}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] border", badge.className)}>
                  {badge.label}
                </Badge>
                {item.triage_status === "new" && item.resolved_at && (
                  <Badge variant="outline" className="text-[10px] border bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]">
                    Updated
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(item.attendance_date), "EEEE, MMM d")}
                {" · "}
                {item.triage_status === "new" && item.resolved_at ? "Updated " : "Submitted "}
                {format(new Date(item.updated_at ?? item.created_at), "h:mm a")}
              </p>
              {item.submitted_reason && (
                <p className="text-xs bg-secondary/60 rounded-md px-2.5 py-1.5 inline-block text-foreground/80">
                  "{item.submitted_reason}"
                </p>
              )}
              {item.admin_note && !showNote && (
                <p className="text-xs text-muted-foreground italic">
                  Staff note: {item.admin_note}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {actionable && (
            <div className={cn("flex gap-2 shrink-0", mobile ? "flex-wrap" : "flex-col")} onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="h-9 text-xs gap-1.5 bg-[hsl(var(--status-success-text))] hover:bg-[hsl(var(--status-success-text))]/90 text-white"
                onClick={() => onAction(item.id, "resolved")}
                disabled={isUpdating}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))] hover:bg-[hsl(var(--status-warning-bg))]"
                onClick={() => onAction(item.id, "needs_info")}
                disabled={isUpdating}
              >
                <HelpCircle className="w-3.5 h-3.5" /> Needs Info
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5"
                onClick={() => setShowNote(!showNote)}
              >
                <PenLine className="w-3.5 h-3.5" /> Correct
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => onAction(item.id, "rejected")}
                disabled={isUpdating}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </div>
          )}
        </div>

        {/* Note input */}
        {showNote && (
          <div className="mt-3 flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add correction note..."
              className="text-sm min-h-[60px]"
            />
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                className="text-xs"
                onClick={() => {
                  onAction(item.id, "corrected", noteText);
                  setShowNote(false);
                }}
                disabled={isUpdating}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowNote(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
