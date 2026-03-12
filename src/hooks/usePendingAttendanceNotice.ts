import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useChildren } from "@/hooks/useChildren";
import type { ParentTriageItem } from "@/hooks/useParentTriageNotices";

const ACTIVE_STATUSES = ["new", "in_review", "needs_info", "escalated"];

/**
 * Returns the most recent pending (unresolved) attendance notice for a given child.
 * Used by the Action Center to show active attendance actions.
 */
export function usePendingAttendanceNotice(childId: string | undefined) {
  const { user } = useSession();
  const { children } = useChildren();

  return useQuery<ParentTriageItem | null>({
    queryKey: ["pending_attendance_notice", childId],
    queryFn: async () => {
      if (!childId) return null;

      if (import.meta.env.DEV) {
        console.log("[ParentNotices] query", { key: ["pending_attendance_notice", childId], childId, filters: ACTIVE_STATUSES });
      }

      const { data, error } = await supabase
        .from("attendance_triage")
        .select("id, child_id, attendance_date, submitted_status, submitted_reason, triage_status, admin_note, created_at")
        .eq("child_id", childId)
        .in("triage_status", ACTIVE_STATUSES)
        .order("attendance_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (import.meta.env.DEV) {
        console.log("[ParentNotices] result", { count: data?.length, first: data?.[0] });
      }

      if (!data || data.length === 0) return null;

      const row = data[0] as any;
      const child = children.find((c) => c.id === row.child_id);

      return {
        ...row,
        child_name: child?.display_name ?? "Student",
      } as ParentTriageItem;
    },
    enabled: !!user && !!childId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export const NOTICE_STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  new: { label: "Sent — awaiting review", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  in_review: { label: "Being reviewed", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  needs_info: { label: "More information needed", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  escalated: { label: "School follow-up needed", className: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]" },
};
