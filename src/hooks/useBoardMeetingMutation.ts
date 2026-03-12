import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BoardMeetingInput {
  id?: string;
  district_id: string;
  meeting_date: string;
  title: string;
  source_url?: string | null;
  summary_short: string;
  key_topics?: string[];
  status?: string;
  relevance_score?: number;
  impact_summary?: string | null;
  affects_students?: boolean;
  affects_safety?: boolean;
  affects_schedule?: boolean;
  affects_policy?: boolean;
}

export function useBoardMeetingMutation(districtId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BoardMeetingInput) => {
      const row = {
        district_id: input.district_id,
        meeting_date: input.meeting_date,
        title: input.title,
        source_url: input.source_url || null,
        summary_short: input.summary_short,
        key_topics: input.key_topics ?? [],
        ...(input.status ? { status: input.status } : {}),
        relevance_score: input.relevance_score ?? 0.3,
        impact_summary: input.impact_summary ?? null,
        affects_students: input.affects_students ?? false,
        affects_safety: input.affects_safety ?? false,
        affects_schedule: input.affects_schedule ?? false,
        affects_policy: input.affects_policy ?? false,
      };

      if (input.id) {
        const { error } = await supabase
          .from("board_meetings")
          .update(row)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("board_meetings")
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-brief-latest", districtId],
      });
    },
  });
}
