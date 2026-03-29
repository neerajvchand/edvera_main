import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { StudentListItem } from "@/types/student";

/* ------------------------------------------------------------------ */
/* Params & result types                                               */
/* ------------------------------------------------------------------ */

export interface StudentListParams {
  search?: string; // searches first_name, last_name, sis_student_id
  schoolId?: string; // filter by school
  page?: number; // 1-based, default 1
  pageSize?: number; // default 25
}

export interface StudentListResult {
  students: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch the active student list with attendance + risk data.
 * Supports server-side search, school filter, and pagination.
 */
export async function getStudentList(
  params: StudentListParams = {}
): Promise<StudentListResult> {
  const { search, schoolId, page = 1, pageSize = 25 } = params;

  try {
    let query = supabase
      .from("students")
      .select(
        `id, first_name, last_name, grade_level, school_id,
         schools!students_school_id_fkey(name)`,
        { count: "exact" }
      )
      .eq("is_active", true);

    // Search across name fields and student ID
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,sis_student_id.ilike.%${search}%`
      );
    }

    // School filter
    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order("last_name")
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) {
      return { students: [], total: count ?? 0, page, pageSize, totalPages: 0 };
    }

    const studentIds = data.map((s) => s.id);

    // Fetch snapshots and risk signals for visible page
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

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    const students: StudentListItem[] = data.map((s) => {
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

    return { students, total, page, pageSize, totalPages };
  } catch (err) {
    throw handleServiceError("load student list", err);
  }
}
