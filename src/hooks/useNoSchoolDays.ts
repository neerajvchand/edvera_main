import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const NO_SCHOOL_CATEGORIES = ["Holiday", "holiday", "no_school", "break", "No School"];

/**
 * Fetch school_events that indicate no school (holidays, breaks)
 * within a given date range for a specific school.
 * Returns a Set of YYYY-MM-DD strings.
 */
export function useNoSchoolDays(
  schoolId: string | undefined,
  weekStart: string | undefined,
  weekEnd: string | undefined
) {
  return useQuery<Set<string>>({
    queryKey: ["no-school-days", schoolId, weekStart, weekEnd],
    queryFn: async () => {
      if (!schoolId || !weekStart || !weekEnd) return new Set();

      // Query events where start_time falls within the week range
      // and the title or category suggests no school
      const { data, error } = await supabase
        .from("school_events")
        .select("start_time, title, category")
        .eq("school_id", schoolId)
        .gte("start_time", `${weekStart}T00:00:00`)
        .lte("start_time", `${weekEnd}T23:59:59`);

      if (error) throw error;

      const dates = new Set<string>();
      for (const event of data ?? []) {
        const isNoSchool =
          NO_SCHOOL_CATEGORIES.includes(event.category ?? "") ||
          /no school/i.test(event.title ?? "");
        if (isNoSchool) {
          // Extract date portion from start_time
          const dateStr = event.start_time.slice(0, 10);
          dates.add(dateStr);
        }
      }
      return dates;
    },
    enabled: !!schoolId && !!weekStart && !!weekEnd,
    staleTime: 10 * 60 * 1000,
  });
}
