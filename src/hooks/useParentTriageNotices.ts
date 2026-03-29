import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useChildren } from "@/hooks/useChildren";

export interface ParentTriageItem {
  id: string;
  child_id: string;
  child_name: string;
  attendance_date: string;
  submitted_status: string;
  submitted_reason: string | null;
  triage_status: string;
  admin_note: string | null;
  created_at: string;
}

export function useParentTriageNotices() {
  const { user } = useSession();
  const { children } = useChildren();
  const childIds = children.map((c) => c.id);

  return useQuery<ParentTriageItem[]>({
    queryKey: ["parent_triage_notices", user?.id, childIds],
    queryFn: async () => {
      if (childIds.length === 0) return [];

      const { data, error } = await supabase
        .from("attendance_triage")
        .select("id, child_id, attendance_date, submitted_status, submitted_reason, triage_status, admin_note, created_at")
        .in("child_id", childIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const childMap = Object.fromEntries(children.map((c) => [c.id, c.display_name]));

      return ((data ?? []) as any[]).map((row) => ({
        ...row,
        child_name: childMap[row.child_id] ?? "Student",
      }));
    },
    enabled: !!user && childIds.length > 0,
    staleTime: 30_000,
  });
}
