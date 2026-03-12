import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type DayType = 'regular' | 'minimum' | 'noschool' | 'holiday' | 'weekend' | 'emergency'

export interface TodayData {
  school: {
    name: string
    district: string
  }
  date: string
  dayOfWeek: string
  dayType: DayType
  isEmergency: boolean
  specialEvent: string | null
  eventDescription: string | null
  startTime: string
  pickupTime: string
  notes: string | null
  backgroundColor: string
  borderColor: string
  lastUpdated: string
}

export function useTodayData(schoolId: string, gradeLevel: string = '3-5') {
  return useQuery({
    queryKey: ['today', schoolId, gradeLevel],
    queryFn: async (): Promise<TodayData> => {
      const { data, error } = await supabase.rpc('get_today_data' as any, {
        p_school_id: schoolId,
        p_grade_level: gradeLevel
      })

      if (error) throw error

      return data as unknown as TodayData
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true
  })
}
