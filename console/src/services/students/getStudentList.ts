import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { StudentListItem } from "@/types/student";

/**
 * Fetch the active student list with attendance + risk data.
 * Used by StudentsPage.
 */
export async function getStudentList(): Promise<StudentListItem[]> {
  try {
    const { data, error } = await supabase
      .from("students")
      .select(
        `id, first_name, last_name, grade_level, school_id,
         schools!students_school_id_fkey(name)`
      )
      .eq("is_active", true)
      .order("last_name")
      .limit(100);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const studentIds = data.map((s) => s.id);

    const [{ data: snapshots, error: snapErr }, { data: signals, error: sigErr }] =
      await Promise.all([
        supabase
          .from("attendance_snapshots")
          .select("student_id, attendance_rate, is_chronic_absent, days_absent")
          .in("student_id", studentIds),
        supabase
          .from("risk_signals")
          .select("student_id, signal_level")
          .in("student_id", studentIds),
      ]);

    if (snapErr) throw snapErr;
    if (sigErr) throw sigErr;

    const snapMap = new Map(
      (snapshots ?? []).map((s) => [s.student_id, s])
    );
    const sigMap = new Map(
      (signals ?? []).map((s) => [s.student_id, s])
    );

    return data.map((s) => {
      const school = Array.isArray(s.schools) ? s.schools[0] : s.schools;
      const snap = snapMap.get(s.id);
      const sig = sigMap.get(s.id);

      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        grade_level: s.grade_level,
        school_name: school?.name ?? null,
        attendance_rate: snap?.attendance_rate ?? null,
        is_chronic_absent: snap?.is_chronic_absent ?? null,
        days_absent: snap?.days_absent ?? null,
        signal_level: sig?.signal_level ?? null,
      };
    });
  } catch (err) {
    throw handleServiceError("load student list", err);
  }
}
