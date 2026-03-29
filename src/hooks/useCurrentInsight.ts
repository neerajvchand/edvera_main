import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useSession } from "@/hooks/useSession";
import type { CurrentInsight } from "@/types/insights";

export function useCurrentInsight() {
  const { school } = useSelectedChild();
  const { user } = useSession();
  const schoolUuid = school?.id;
  const userId = user?.id;

  return useQuery<CurrentInsight | null>({
    queryKey: ["current-insight", schoolUuid, userId],
    enabled: !!userId && !!schoolUuid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_insight_for_school", {
        p_school_id: schoolUuid!,
        p_user_id: userId!,
      });

      if (error) throw error;
      if (!data || (Array.isArray(data) && data.length === 0)) return null;

      const row = Array.isArray(data) ? data[0] : data;
      return row as unknown as CurrentInsight;
    },
    refetchInterval: 60_000,
  });
}

export function useInsightById(insightId: string | undefined) {
  return useQuery<CurrentInsight | null>({
    queryKey: ["insight-detail", insightId],
    enabled: !!insightId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights")
        .select("*")
        .eq("id", insightId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        insight_id: data.id,
        insight_key: data.insight_key,
        category: data.category,
        severity: data.severity,
        headline: data.headline,
        context: data.context,
        why_this: data.why_this,
        source: data.source,
        last_updated: data.last_updated,
        mini_viz_type: data.mini_viz_type,
        payload: data.payload as any,
        priority_score: 0,
        school_insight_id: "",
      } as unknown as CurrentInsight;
    },
  });
}
