import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useMemo } from "react";
import { computeAttendanceMetrics } from "@/lib/attendanceMetrics";
import type { AttendanceRecord } from "@/types/schoolpulse";

export interface AttendanceEntry {
  id: string;
  child_id: string;
  attendance_date: string;
  status: string;
  reason: string | null;
  period: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get today's date in the school's timezone (falls back to America/Los_Angeles).
 */
function todayInSchoolTz(timezone?: string): string {
  const tz = timezone || "America/Los_Angeles";
  const now = new Date();
  // Intl gives us locale-formatted parts; rebuild as YYYY-MM-DD
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA format is YYYY-MM-DD
}

export function useAttendanceEntries() {
  const { selectedChild, school } = useSelectedChild();
  const queryClient = useQueryClient();
  const childId = selectedChild?.id;
  const schoolTz = (school as any)?.timezone as string | undefined;

  const query = useQuery<AttendanceEntry[]>({
    queryKey: ["attendance_entries", childId],
    queryFn: async () => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from("attendance_entries")
        .select("*")
        .eq("child_id", childId)
        .order("attendance_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as AttendanceEntry[];
    },
    enabled: !!childId,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  });

  // Convert DB rows → AttendanceRecord for metrics
  const records: AttendanceRecord[] = useMemo(
    () =>
      (query.data ?? []).map((e) => ({
        date: e.attendance_date,
        status: e.status as AttendanceRecord["status"],
        reason: e.reason ?? undefined,
        period: e.period ?? undefined,
      })),
    [query.data]
  );

  const metrics = useMemo(() => computeAttendanceMetrics(records), [records]);

  const upsertAttendance = useMutation({
    mutationFn: async ({
      status,
      reason,
      date,
    }: {
      status: string;
      reason?: string;
      date?: string;
    }) => {
      if (!childId) throw new Error("No child selected");
      const attendanceDate = date ?? todayInSchoolTz(schoolTz);

      if (import.meta.env.DEV) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        console.log("[NotifySchool] userId", currentUser?.id);
        console.log("[NotifySchool] selectedChild", { childId, schoolId: (school as any)?.id, childName: (school as any)?.name });
        console.log("[NotifySchool] computed attendance_date", { date: attendanceDate, tz: schoolTz });
        console.log("[NotifySchool] payload", { child_id: childId, attendance_date: attendanceDate, status, reason });
      }

      const { data: entryData, error } = await supabase
        .from("attendance_entries")
        .upsert(
          {
            child_id: childId,
            attendance_date: attendanceDate,
            status,
            reason: reason ?? null,
          } as any,
          { onConflict: "child_id,attendance_date" }
        )
        .select("id")
        .single();

      if (import.meta.env.DEV) {
        console.log("[NotifySchool] entry insert result", { data: entryData, error });
      }

      if (error) throw error;

      // Create triage row for non-present entries or entries with reasons
      if (status !== "present" || (reason && reason.trim())) {
        const schoolId = (school as any)?.id;
        const { data: { user } } = await supabase.auth.getUser();
        if (schoolId && user) {
          // Read existing triage row to detect correction (reopening)
          let oldTriageStatus: string | null = null;
          const { data: existingTriage } = await supabase
            .from("attendance_triage")
            .select("id, triage_status, resolved_at")
            .eq("child_id", childId)
            .eq("attendance_date", attendanceDate)
            .maybeSingle();
          oldTriageStatus = existingTriage?.triage_status ?? null;

          const triagePayload = {
            school_id: schoolId,
            child_id: childId,
            attendance_date: attendanceDate,
            submitted_status: status,
            submitted_reason: reason ?? null,
            submitted_by_user_id: user.id,
            source_attendance_entry_id: entryData?.id ?? null,
            triage_status: "new",
            // Reset admin fields so item reappears in admin queue
            // Keep resolved_at as historical marker for correction detection
            admin_note: null,
            resolved_by: null,
          };

          const DIAG = import.meta.env.DEV || localStorage.getItem("edvera_diag") === "1";
          if (DIAG) {
            console.log("[ATTEND_AUDIT_PARENT] correction submit", {
              attendance_entry_id: entryData?.id,
              child_id: childId,
              date: attendanceDate,
              old_triage_status: oldTriageStatus,
              new_triage_status: "new",
              payload: triagePayload,
            });
          }

          const { data: triageData, error: triageError } = await supabase
            .from("attendance_triage")
            .upsert(
              triagePayload as any,
              { onConflict: "child_id,attendance_date" }
            )
            .select("id, triage_status, attendance_date, school_id")
            .single();

          if (DIAG) {
            console.log("[ATTEND_AUDIT_PARENT] triage upsert result", {
              attendance_entry_id: entryData?.id,
              child_id: childId,
              date: attendanceDate,
              old_triage_status: oldTriageStatus,
              new_triage_status: triageData?.triage_status ?? null,
              triage_upsert_result: triageData,
              error: triageError,
            });
          }

          if (triageError) {
            console.error("[ATTEND_AUDIT_PARENT] triage upsert error:", triageError);
            // Non-blocking toast in dev
            if (DIAG) {
              const { toast } = await import("sonner");
              toast.error("Update saved, but office review could not be re-opened. (dev)");
            }
          }
        } else if (import.meta.env.DEV) {
          console.warn("[NotifySchool] Triage skipped — missing schoolId:", schoolId, "or user:", !!user);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_entries", childId] });
      queryClient.invalidateQueries({ queryKey: ["pending_attendance_notice", childId] });
      queryClient.invalidateQueries({ queryKey: ["parent_triage_status", childId] });
      queryClient.invalidateQueries({ queryKey: ["debug_triage_row", childId] });
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  return {
    entries: query.data ?? [],
    records,
    metrics,
    isLoading: query.isLoading,
    upsertAttendance: upsertAttendance.mutateAsync,
    isUpserting: upsertAttendance.isPending,
    todayDate: todayInSchoolTz(schoolTz),
  };
}
