import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type {
  StudentBasic,
  Snapshot,
  RiskSignal,
  ComplianceCase,
  Action,
  AttendanceRecord,
  InterventionEntry,
  StudentDetailResponse,
} from "@/types/student";

/**
 * Fetch everything needed for the student detail page.
 * Runs three query batches in parallel for speed.
 */
export async function getStudentDetail(
  studentId: string
): Promise<StudentDetailResponse | null> {
  try {
    // --- Batch 1: Header data ---
    const [
      { data: rawStudent, error: stuErr },
      { data: snap, error: snapErr },
      { data: sig, error: sigErr },
      { data: openCases, error: ccErr },
    ] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, first_name, last_name, grade_level, gender, birth_date, language_fluency, schools!students_school_id_fkey(name)"
        )
        .eq("id", studentId)
        .single(),
      supabase
        .from("attendance_snapshots")
        .select("*")
        .eq("student_id", studentId)
        .single(),
      supabase
        .from("risk_signals")
        .select("*")
        .eq("student_id", studentId)
        .single(),
      supabase
        .from("compliance_cases")
        .select("*")
        .eq("student_id", studentId)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (stuErr) throw stuErr;
    if (!rawStudent) return null;

    // --- Batch 2: Timeline + chart data (parallel) ---
    const [
      { data: abs, error: absErr },
      { data: acts, error: actErr },
      { data: ivs, error: ivErr },
      { data: allCc, error: allCcErr },
      { data: allAtt, error: allAttErr },
    ] = await Promise.all([
      supabase
        .from("attendance_daily")
        .select("id, calendar_date, canonical_type, sis_absence_code")
        .eq("student_id", studentId)
        .neq("canonical_type", "present")
        .order("calendar_date", { ascending: false })
        .limit(500),
      supabase
        .from("actions")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("intervention_log")
        .select("*")
        .eq("student_id", studentId)
        .order("intervention_date", { ascending: false })
        .limit(100),
      supabase
        .from("compliance_cases")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("attendance_daily")
        .select("calendar_date, canonical_type")
        .eq("student_id", studentId)
        .order("calendar_date", { ascending: true }),
    ]);

    // Non-critical errors for secondary data are logged but not thrown
    if (absErr) console.error("Failed to load absences:", absErr);
    if (actErr) console.error("Failed to load actions:", actErr);
    if (ivErr) console.error("Failed to load interventions:", ivErr);
    if (allCcErr) console.error("Failed to load compliance cases:", allCcErr);
    if (allAttErr) console.error("Failed to load attendance chart:", allAttErr);

    const student: StudentBasic = {
      ...rawStudent,
      school: Array.isArray(rawStudent.schools)
        ? rawStudent.schools[0]
        : (rawStudent.schools as { name: string } | null),
    };

    const activeCase: ComplianceCase | null =
      (openCases?.[0] as ComplianceCase | undefined) ??
      (allCc?.[0] as ComplianceCase | undefined) ??
      null;

    return {
      student,
      snapshot: (snap as Snapshot | null) ?? null,
      signal: (sig as RiskSignal | null) ?? null,
      activeCase,
      allComplianceCases: (allCc as ComplianceCase[] | null) ?? [],
      actions: (acts as Action[] | null) ?? [],
      absences: (abs as AttendanceRecord[] | null) ?? [],
      interventions: (ivs as InterventionEntry[] | null) ?? [],
      allAttendance: (allAtt as { calendar_date: string; canonical_type: string }[] | null) ?? [],
    };
  } catch (err) {
    throw handleServiceError("load student detail", err);
  }
}
