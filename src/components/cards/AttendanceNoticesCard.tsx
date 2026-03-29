import { useState, useMemo } from "react";
import { useParentTriageNotices, type ParentTriageItem } from "@/hooks/useParentTriageNotices";
import { useAttendanceEntries } from "@/hooks/useAttendanceEntries";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParentNoticeDetailModal } from "@/components/modals/ParentNoticeDetailModal";

const ACTIVE_STATUSES = ["new", "in_review", "needs_info", "escalated"];

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  new: { label: "Received", className: "bg-secondary text-muted-foreground border-border" },
  in_review: { label: "Being reviewed", className: "bg-secondary text-muted-foreground border-border" },
  needs_info: { label: "More info needed", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  resolved: { label: "Accepted", className: "bg-secondary text-muted-foreground border-border" },
  accepted: { label: "Accepted", className: "bg-secondary text-muted-foreground border-border" },
  corrected: { label: "Updated by school", className: "bg-secondary text-muted-foreground border-border" },
  rejected: { label: "Not accepted", className: "bg-secondary text-muted-foreground border-border" },
};

export function AttendanceNoticesCard() {
  const { data: notices, isLoading } = useParentTriageNotices();
  const { todayDate } = useAttendanceEntries();
  const [selectedNotice, setSelectedNotice] = useState<ParentTriageItem | null>(null);

  // Filter out today's entries — today is shown in the status card above; history is for past dates only
  const items = useMemo(
    () => (notices ?? []).filter((n) => n.attendance_date < todayDate),
    [notices, todayDate]
  );

  if (isLoading) return null;
  if (items.length === 0) return null;

  return (
    <>
      <div className="pulse-card">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Attendance History</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Past attendance notices</p>

        <div className="space-y-1.5">
            {items.slice(0, 5).map((item) => {
              const status = STATUS_DISPLAY[item.triage_status] ?? STATUS_DISPLAY.new;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-secondary/60 transition-colors"
                  onClick={() => setSelectedNotice(item)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground truncate">
                        {item.child_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.submitted_status}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(item.attendance_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] border shrink-0", status.className)}
                  >
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
      </div>

      {selectedNotice && (
        <ParentNoticeDetailModal
          item={selectedNotice}
          open={!!selectedNotice}
          onOpenChange={(open) => { if (!open) setSelectedNotice(null); }}
        />
      )}
    </>
  );
}
