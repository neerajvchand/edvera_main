import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComingUpEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  category: string | null;
}

export function useComingUp(schoolUuid: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['coming-up', schoolUuid, limit],
    queryFn: async (): Promise<ComingUpEvent[]> => {
      const { data, error } = await supabase.rpc('get_coming_up' as any, {
        p_school_id: schoolUuid!,
        p_limit: limit,
      });
      if (error) throw error;
      return (data as ComingUpEvent[]) ?? [];
    },
    enabled: !!schoolUuid,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
