import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export interface TriageItem {
  id: string;
  school_id: string;
  child_id: string;
  child_name?: string;
  parent_name?: string;
  submitted_by_user_id?: string | null;
  attendance_date: string;
  submitted_status: string;
  submitted_reason: string | null;
  triage_status: string;
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAttendanceTriage(
  schoolId: string | null,
  statusFilter: string = "all"
) {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery<TriageItem[]>({
    queryKey: ["attendance_triage", schoolId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("attendance_triage")
        .select("*")
        .eq("school_id", schoolId!)
        .order("updated_at", { ascending: false });

      if (statusFilter === "new_review") {
        q = q.in("triage_status", ["new", "in_review"]);
      } else if (statusFilter !== "all") {
        q = q.eq("triage_status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Fetch child names + parent info
      const childIds = [...new Set((data ?? []).map((d: any) => d.child_id))];
      const parentIds = [...new Set((data ?? []).map((d: any) => d.submitted_by_user_id).filter(Boolean))];

      let childMap: Record<string, { name: string; parentId: string }> = {};
      if (childIds.length > 0) {
        const { data: children } = await supabase
          .from("children")
          .select("id, display_name, parent_id")
          .in("id", childIds);
        childMap = Object.fromEntries(
          (children ?? []).map((c: any) => [c.id, { name: c.display_name, parentId: c.parent_id }])
        );
      }

      let profileMap: Record<string, string> = {};
      if (parentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", parentIds);
        profileMap = Object.fromEntries(
          (profiles ?? []).map((p: any) => [p.user_id, p.display_name])
        );
      }

      const result = ((data ?? []) as any[]).map((row) => {
        const childInfo = childMap[row.child_id];
        const childName = childInfo?.name ?? `Student …${row.child_id.slice(-6)}`;
        const parentName = row.submitted_by_user_id
          ? profileMap[row.submitted_by_user_id] ?? null
          : null;
        return {
          ...row,
          child_name: childName,
          parent_name: parentName,
        };
      });

      if (import.meta.env.DEV) {
        console.log("Triage query:", { schoolId, count: result.length, first3: result.slice(0, 3).map((r: any) => ({ id: r.id, child_id: r.child_id, triage_status: r.triage_status, attendance_date: r.attendance_date, created_at: r.created_at })) });
      }

      return result;
    },
    enabled: !!schoolId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const updateTriage = useMutation({
    mutationFn: async ({
      id,
      triage_status,
      admin_note,
    }: {
      id: string;
      triage_status: string;
      admin_note?: string;
    }) => {
      if (!user || !schoolId) throw new Error("Missing context");

      const payload: any = {
        triage_status,
        ...(admin_note !== undefined ? { admin_note } : {}),
        ...(triage_status === "resolved" || triage_status === "rejected"
          ? { resolved_at: new Date().toISOString(), resolved_by: user.id }
          : {}),
      };

      const DIAG = import.meta.env.DEV || localStorage.getItem("edvera_diag") === "1";
      if (DIAG) {
        console.log("[Triage:update]", { id, oldStatus: "unknown", newStatus: triage_status, admin_note, resolved_by: payload.resolved_by, resolved_at: payload.resolved_at });
      }

      const { error } = await supabase
        .from("attendance_triage")
        .update(payload)
        .eq("id", id);

      if (error) throw error;

      const auditAction = triage_status === "needs_info" ? "NEEDS_INFO_TRIAGE"
        : triage_status === "rejected" ? "REJECT_TRIAGE"
        : triage_status === "corrected" ? "CORRECT_TRIAGE"
        : "RESOLVE_TRIAGE";

      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: auditAction,
        entity: "attendance_triage",
        entity_id: id,
        meta: { triage_status, ...(admin_note ? { note: admin_note } : {}) },
      } as any);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["attendance_triage", schoolId] }),
  });

  const newCount = (query.data ?? []).filter(
    (t) => t.triage_status === "new" || t.triage_status === "in_review"
  ).length;

  return {
    items: query.data ?? [],
    newCount,
    isLoading: query.isLoading,
    updateTriage: updateTriage.mutateAsync,
    isUpdating: updateTriage.isPending,
  };
}
