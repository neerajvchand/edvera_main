import { useState, useEffect, useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Phone, CalendarIcon, Clock, CalendarX, ArrowRightFromLine, Check } from "lucide-react";
import { useAttendanceEntries } from "@/hooks/useAttendanceEntries";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface MarkAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateOverride?: string;
  initialStatus?: "present" | "absent" | "tardy" | "leave_early";
}

const STATUS_OPTIONS = [
  { value: "tardy" as const, label: "Running Late", icon: Clock },
  { value: "absent" as const, label: "Absent Today", icon: CalendarX },
  { value: "leave_early" as const, label: "Leaving Early", icon: ArrowRightFromLine },
  { value: "present" as const, label: "Present", icon: Check },
];

const REASON_CHIPS = [
  "Sick",
  "Appointment",
  "Travel",
  "Family",
  "Other",
];

export function MarkAttendanceModal({ open, onOpenChange, dateOverride, initialStatus }: MarkAttendanceModalProps) {
  const { selectedChild, school } = useSelectedChild();
  const { upsertAttendance, isUpserting, todayDate, entries } = useAttendanceEntries();
  const [status, setStatus] = useState<"present" | "absent" | "tardy" | "leave_early">(initialStatus ?? "tardy");
  const [note, setNote] = useState("");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showNotify, setShowNotify] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const schoolAny = school as any;
  const attendancePhone: string | null = schoolAny?.attendance_phone ?? null;
  const attendanceExt: string | null = schoolAny?.attendance_extension ?? null;

  const effectiveDate = dateOverride ?? (selectedDate ? format(selectedDate, "yyyy-MM-dd") : todayDate);

  // Check if already submitted for this date
  const existingEntry = useMemo(() => {
    if (!selectedChild) return null;
    return entries.find(
      (e) => e.child_id === selectedChild.id && e.attendance_date === effectiveDate
    ) ?? null;
  }, [entries, selectedChild, effectiveDate]);

  const buildTelLink = () => {
    if (!attendancePhone) return null;
    const digits = attendancePhone.replace(/\D/g, "");
    return attendanceExt ? `tel:${digits},,${attendanceExt}` : `tel:${digits}`;
  };

  const handleSave = async () => {
    try {
      const reasonParts = [selectedReason, note.trim()].filter(Boolean).join(" — ");
      await upsertAttendance({
        status,
        reason: reasonParts || undefined,
        date: effectiveDate,
      });
      toast.success(existingEntry ? "Attendance updated." : "Your notice was sent to the office.");

      if ((status === "absent" || status === "tardy") && !existingEntry) {
        setShowNotify(true);
      } else {
        resetAndClose();
      }
    } catch {
      toast.error("Couldn't save attendance. Please try again.");
    }
  };

  const resetAndClose = () => {
    setStatus(initialStatus ?? "tardy");
    setNote("");
    setSelectedReason(null);
    setSelectedDate(undefined);
    setShowNotify(false);
    onOpenChange(false);
  };

  // Sync when modal opens
  useEffect(() => {
    if (open) {
      if (initialStatus) setStatus(initialStatus);
      // Prefill from existing entry if editing
      if (existingEntry) {
        setStatus(existingEntry.status as any);
        // Parse reason back to chip + note
        const parts = (existingEntry.reason ?? "").split(" — ");
        const chipMatch = REASON_CHIPS.find((c) => parts[0] === c);
        if (chipMatch) {
          setSelectedReason(chipMatch);
          setNote(parts.slice(1).join(" — "));
        } else {
          setSelectedReason(null);
          setNote(existingEntry.reason ?? "");
        }
      } else {
        setNote("");
        setSelectedReason(null);
      }
    }
  }, [open, initialStatus, existingEntry]);

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setStatus(initialStatus ?? "tardy");
      setNote("");
      setSelectedReason(null);
      setSelectedDate(undefined);
      setShowNotify(false);
    }
    onOpenChange(val);
  };

  const telLink = buildTelLink();
  const dateLabel = effectiveDate === todayDate
    ? "Today"
    : format(parseISO(effectiveDate), "EEE, MMM d");

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        {showNotify ? (
          /* ── Notify school sheet ── */
          <div className="px-4 pb-6 pt-2">
            <DrawerHeader className="px-0">
              <DrawerTitle>Notify the school?</DrawerTitle>
              <DrawerDescription>
                Attendance has been saved. Would you like to call the school's attendance line?
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-3 pt-2">
              {telLink ? (
                <a
                  href={telLink}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Call attendance line
                  {attendanceExt && (
                    <span className="text-primary-foreground/70 text-xs">(ext. {attendanceExt})</span>
                  )}
                </a>
              ) : null}
              <Button variant="ghost" className="w-full" onClick={resetAndClose}>
                Not now
              </Button>
            </div>
          </div>
        ) : (
          /* ── Attendance form ── */
          <div className="px-4 pb-6 pt-2 overflow-y-auto">
            <DrawerHeader className="px-0">
              <DrawerTitle>
                {existingEntry ? "Edit Attendance" : "Notify School"}
              </DrawerTitle>
              {selectedChild && (
                <DrawerDescription>
                  For {selectedChild.display_name}
                </DrawerDescription>
              )}
            </DrawerHeader>

            <div className="space-y-5 pt-1">
              {/* Date selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                {dateOverride ? (
                  <p className="text-sm font-medium text-foreground">
                    {format(parseISO(dateOverride), "EEEE, MMM d, yyyy")}
                  </p>
                ) : (
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-foreground"
                        )}
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {dateLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate ?? parseISO(todayDate)}
                        onSelect={(d) => {
                          setSelectedDate(d);
                          setDatePickerOpen(false);
                        }}
                        disabled={(date) => date > new Date()}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Status selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">What's happening?</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                          status === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {REASON_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setSelectedReason(selectedReason === chip ? null : chip)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        selectedReason === chip
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Add a note (optional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. doctor appointment at 10am"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            <DrawerFooter className="px-0 pt-4">
              <Button onClick={handleSave} disabled={isUpserting || !selectedChild} className="w-full">
                {isUpserting ? "Saving…" : existingEntry ? "Update" : "Submit"}
              </Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isUpserting} className="w-full">
                Cancel
              </Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
