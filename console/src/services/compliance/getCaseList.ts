/**
 * Fetch open compliance cases for the case tracker table.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ComplianceCaseRow {
  id: string;
  student_id: string;
  student_name: string;
  school_name: string;
  current_tier: string;
  unexcused_absence_count: number;
  total_absence_count: number;
  is_resolved: boolean;
  sarb_packet_status: string;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getCaseList(): Promise<ComplianceCaseRow[]> {
  try {
    const { data } = await supabase
      .from("compliance_cases")
      .select(
        `id, student_id, current_tier, unexcused_absence_count, total_absence_count, is_resolved, sarb_packet_status,
         students!compliance_cases_student_id_fkey(first_name, last_name),
         schools!compliance_cases_school_id_fkey(name)`
      )
      .eq("is_resolved", false)
      .order("current_tier", { ascending: false })
      .limit(100);

    return (data ?? []).map((c: any) => ({
      id: c.id,
      student_id: c.student_id,
      student_name: c.students
        ? `${c.students.last_name}, ${c.students.first_name}`
        : "Unknown",
      school_name: c.schools?.name ?? "Unknown",
      current_tier: c.current_tier,
      unexcused_absence_count: c.unexcused_absence_count,
      total_absence_count: c.total_absence_count,
      is_resolved: c.is_resolved,
      sarb_packet_status: c.sarb_packet_status ?? "not_started",
    }));
  } catch (err) {
    throw handleServiceError("load compliance cases", err);
  }
}
