import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BoardMeeting {
  id: string;
  district_id: string;
  meeting_date: string;
  title: string;
  source_url: string | null;
  summary_short: string | null;
  key_topics: string[];
}

/** Fetch the latest board meeting for a given district. */
export function useLatestBoardBrief(districtId: string | null | undefined) {
  return useQuery({
    queryKey: ['board-brief-latest', districtId],
    queryFn: async (): Promise<BoardMeeting | null> => {
      const { data, error } = await supabase
        .from('board_meetings' as any)
        .select('id, district_id, meeting_date, title, source_url, summary_short, key_topics')
        .eq('district_id', districtId!)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as BoardMeeting | null;
    },
    enabled: !!districtId,
    staleTime: 30 * 60 * 1000,
  });
}
