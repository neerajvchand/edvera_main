import type { ParentTriageItem } from "@/hooks/useParentTriageNotices";
import { ModalShell } from "@/components/modals/ModalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertCircle, MessageSquare } from "lucide-react";

interface Props {
  item: ParentTriageItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  new: { label: "Received", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  in_review: { label: "Being reviewed", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  needs_info: { label: "More information needed", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  resolved: { label: "Accepted", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  accepted: { label: "Accepted", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  corrected: { label: "Updated by school", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  rejected: { label: "Not accepted", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function ParentNoticeDetailModal({ item, open, onOpenChange }: Props) {
  const status = STATUS_DISPLAY[item.triage_status] ?? STATUS_DISPLAY.new;
  const handleClose = () => onOpenChange(false);

  return (
    <ModalShell
      title="Attendance Notice"
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <Button variant="outline" size="sm" onClick={handleClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{item.child_name}</span>
            <Badge variant="outline" className="text-[10px]">{item.submitted_status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(item.attendance_date), "EEEE, MMMM d, yyyy")}
          </p>
          {item.submitted_reason && (
            <p className="text-sm bg-secondary/60 rounded-lg px-3 py-2 text-foreground/80">
              "{item.submitted_reason}"
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Submitted {format(new Date(item.created_at), "MMM d, h:mm a")}
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
          <Badge className={cn("text-sm px-3 py-1 border", status.className)}>{status.label}</Badge>

          {item.triage_status === "needs_info" && (
            <div className="flex items-start gap-2 bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-border))] rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-[hsl(var(--status-warning-text))] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[hsl(var(--status-warning-text))] mb-1">
                  The school needs more information:
                </p>
                <p className="text-xs text-[hsl(var(--status-warning-text))]">
                  {item.admin_note || "The office requested additional details."}
                </p>
              </div>
            </div>
          )}

          {item.triage_status === "needs_info" && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5 mt-1" onClick={handleClose}>
              <MessageSquare className="w-3.5 h-3.5" /> Respond
            </Button>
          )}
        </section>

        {item.triage_status !== "needs_info" && item.admin_note && (
          <>
            <Separator />
            <section className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">School Note</h4>
              <p className="text-xs text-foreground/80 italic">{item.admin_note}</p>
            </section>
          </>
        )}
      </div>
    </ModalShell>
  );
}
