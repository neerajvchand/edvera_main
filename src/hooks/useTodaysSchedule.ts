import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BellBlock {
  label: string;
  start_local: string;
  end_local: string;
  sort_order: number;
}

export function useTodaysSchedule(schoolUuid: string | undefined) {
  return useQuery({
    queryKey: ['todays-schedule', schoolUuid],
    queryFn: async (): Promise<BellBlock[]> => {
      const { data, error } = await supabase.rpc('get_todays_schedule' as any, {
        p_school_id: schoolUuid!,
      });
      if (error) throw error;
      return (data as BellBlock[]) ?? [];
    },
    enabled: !!schoolUuid,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
