import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { ActionListItem } from "@/types/action";

export interface SchoolOption {
  id: string;
  name: string;
}

/**
 * Fetch all actions with joined student and school names.
 * Returns the flat ActionListItem array + school options for filters.
 */
export async function getActionList(): Promise<{
  actions: ActionListItem[];
  schools: SchoolOption[];
}> {
  try {
    const [{ data: actionsData, error: actErr }, { data: schoolsData, error: schErr }] =
      await Promise.all([
        supabase
          .from("actions")
          .select(
            `id, student_id, school_id, compliance_case_id, action_type, title,
             reason, priority, status, due_date, completed_at, completion_outcome,
             created_at, students!actions_student_id_fkey(first_name, last_name),
             schools!actions_school_id_fkey(name)`
          )
          .order("due_date", { ascending: true })
          .limit(500),
        supabase.from("schools").select("id, name").order("name"),
      ]);

    if (actErr) throw actErr;
    if (schErr) throw schErr;

    const actions: ActionListItem[] = (actionsData ?? []).map((a: any) => ({
      id: a.id,
      student_id: a.student_id,
      school_id: a.school_id,
      compliance_case_id: a.compliance_case_id,
      action_type: a.action_type,
      title: a.title,
      reason: a.reason,
      priority: a.priority,
      status: a.status,
      due_date: a.due_date,
      completed_at: a.completed_at,
      completion_outcome: a.completion_outcome,
      created_at: a.created_at,
      student_name: a.students
        ? `${a.students.last_name}, ${a.students.first_name}`
        : "Unknown",
      school_name: a.schools?.name ?? "Unknown",
    }));

    const schools: SchoolOption[] = (schoolsData ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
    }));

    return { actions, schools };
  } catch (err) {
    throw handleServiceError("load action list", err);
  }
}
