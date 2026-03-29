import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, AlertCircle, ShieldCheck } from "lucide-react";

type UIState = "SUBMITTED" | "NEEDS_INFO" | "CONFIRMED";

interface AttendanceReceiptDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childName: string;
  attendanceDate: string;
  status: string; // absent, tardy, leave_early
  reason: string | null;
  submittedAt: string; // created_at ISO
  uiState: UIState;
  adminNote?: string | null;
  resolvedAt?: string | null;
}

function getStatusLabel(status: string): string {
  if (status === "tardy") return "Running Late";
  if (status === "absent") return "Absent";
  if (status === "leave_early") return "Leaving Early";
  return status;
}

function ProcessingStatus({ uiState, adminNote, resolvedAt }: { uiState: UIState; adminNote?: string | null; resolvedAt?: string | null }) {
  if (uiState === "CONFIRMED") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))] px-3 py-2.5">
        <ShieldCheck className="w-4 h-4 text-[hsl(var(--status-success-text))] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[hsl(var(--status-success-text))]">Confirmed by office</p>
          {resolvedAt && (
            <p className="text-xs text-[hsl(var(--status-success-text))]/80 mt-0.5">
              Processed {format(new Date(resolvedAt), "MMM d 'at' h:mm a")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (uiState === "NEEDS_INFO") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-border))] px-3 py-2.5">
        <AlertCircle className="w-4 h-4 text-[hsl(var(--status-warning-text))] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[hsl(var(--status-warning-text))]">Office needs more info</p>
          {adminNote && (
            <p className="text-xs text-[hsl(var(--status-warning-text))]/80 mt-1">
              "{adminNote}"
            </p>
          )}
        </div>
      </div>
    );
  }

  // SUBMITTED
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-[hsl(var(--status-info-bg))] border border-[hsl(var(--status-info-border))] px-3 py-2.5">
      <Clock className="w-4 h-4 text-[hsl(var(--status-info-text))] mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-[hsl(var(--status-info-text))]">Pending office review</p>
        <p className="text-xs text-[hsl(var(--status-info-text))]/80 mt-0.5">
          We'll update you when the office processes it.
        </p>
      </div>
    </div>
  );
}

export function AttendanceReceiptDrawer({
  open,
  onOpenChange,
  childName,
  attendanceDate,
  status,
  reason,
  submittedAt,
  uiState,
  adminNote,
  resolvedAt,
}: AttendanceReceiptDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="px-4 pb-6 pt-2 overflow-y-auto">
          <DrawerHeader className="px-0">
            <DrawerTitle>Attendance Receipt</DrawerTitle>
            <DrawerDescription>Summary of your submission</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 pt-1">
            {/* Student + Date */}
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{childName}</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(attendanceDate), "EEEE, MMMM d, yyyy")}
              </p>
            </div>

            <Separator />

            {/* Type */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</span>
              <span className="text-sm font-medium text-foreground">{getStatusLabel(status)}</span>
            </div>

            {/* Reason */}
            {reason && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</span>
                <p className="text-sm bg-secondary/60 rounded-lg px-3 py-2 text-foreground/80">
                  {reason}
                </p>
              </div>
            )}

            {/* Submitted at */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Submitted</span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(submittedAt), "MMM d 'at' h:mm a")}
              </span>
            </div>

            <Separator />

            {/* Processing status */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Processing</span>
              <ProcessingStatus uiState={uiState} adminNote={adminNote} resolvedAt={resolvedAt} />
            </div>
          </div>

          <div className="pt-5">
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
