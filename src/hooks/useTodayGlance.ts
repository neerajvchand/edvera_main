import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TodayGlance {
  day_type: string;
  start_time: string | null;
  pickup_time: string | null;
  notes: string | null;
  schedule_name: string | null;
}

export function useTodayGlance(schoolUuid: string | undefined) {
  return useQuery({
    queryKey: ['today-glance', schoolUuid],
    queryFn: async (): Promise<TodayGlance> => {
      const { data, error } = await supabase.rpc('get_today_at_a_glance' as any, {
        p_school_id: schoolUuid!,
      });
      if (error) throw error;
      return data as TodayGlance;
    },
    enabled: !!schoolUuid,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
