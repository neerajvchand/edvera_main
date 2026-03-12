/**
 * Fetches recently completed/deferred actions for the Recent Activity feed.
 * Returns actions from the last 7 days with attribution data.
 */
import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RecentActivityItem {
  id: string;
  action_type: string;
  title: string;
  student_name: string;
  school_name: string;
  status: string;
  completion_outcome: string | null;
  completed_at: string;
  completed_by_name: string | null;
  completed_by_role: string | null;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getRecentActivity(
  limit = 10,
): Promise<RecentActivityItem[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("actions")
    .select(
      `id, action_type, title, status, completion_outcome,
       completed_at, completed_by_name, completed_by_role,
       students!inner(first_name, last_name),
       schools!inner(name)`
    )
    .in("status", ["completed", "deferred"])
    .gte("completed_at", sevenDaysAgo.toISOString())
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentActivity error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const student = row.students as unknown as {
      first_name: string;
      last_name: string;
    };
    const school = row.schools as unknown as { name: string };

    return {
      id: row.id,
      action_type: row.action_type,
      title: row.title,
      student_name: `${student.first_name} ${student.last_name}`,
      school_name: school.name,
      status: row.status,
      completion_outcome: row.completion_outcome,
      completed_at: row.completed_at,
      completed_by_name: row.completed_by_name,
      completed_by_role: row.completed_by_role,
    };
  });
}
