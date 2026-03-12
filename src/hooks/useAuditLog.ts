import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

export function useAuditLog(schoolId: string | null, limit = 10) {
  return useQuery<AuditEntry[]>({
    queryKey: ["audit_log", schoolId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, entity, entity_id, created_at, meta")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AuditEntry[];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });
}
