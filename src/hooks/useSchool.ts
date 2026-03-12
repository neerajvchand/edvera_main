import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SchoolRecord {
  id: string;
  name: string;
  slug: string | null;
  timezone: string;
  district_id: string | null;
  district_name: string | null;
}

/** Fetch a school by its UUID (stored in children.school_id). */
export function useSchool(schoolId: string | undefined) {
  return useQuery({
    queryKey: ['school', schoolId],
    queryFn: async (): Promise<SchoolRecord | null> => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId!)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as SchoolRecord | null;
    },
    enabled: !!schoolId,
    staleTime: 30 * 60 * 1000,
  });
}

/** Fetch all schools for search/selection. */
export function useSchools() {
  return useQuery({
    queryKey: ['schools-all'],
    queryFn: async (): Promise<SchoolRecord[]> => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, slug, timezone')
        .order('name');

      if (error) throw error;
      return (data as unknown as SchoolRecord[]) ?? [];
    },
    staleTime: 30 * 60 * 1000,
  });
}
