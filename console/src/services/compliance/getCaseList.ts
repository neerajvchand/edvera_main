/**
 * Fetch open compliance cases for the case tracker table.
 * Supports server-side search, school filter, tier filter, and pagination.
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
  case_workflow_stage: string;
  packet_stage: string;
  outcome_stage: string | null;
  assigned_to: string | null;
  opened_at: string;
}

export interface CaseListParams {
  search?: string; // searches student name (via text search on joined student)
  schoolId?: string; // filter by school
  tier?: string; // filter by current_tier
  page?: number; // 1-based, default 1
  pageSize?: number; // default 25
}

export interface CaseListResult {
  cases: ComplianceCaseRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getCaseList(
  params: CaseListParams = {}
): Promise<CaseListResult> {
  const { search, schoolId, tier, page = 1, pageSize = 25 } = params;

  try {
    let query = supabase
      .from("compliance_cases")
      .select(
        `id, student_id, current_tier, unexcused_absence_count, total_absence_count, is_resolved, sarb_packet_status,
         case_workflow_stage, packet_stage, outcome_stage, assigned_to, created_at,
         students!compliance_cases_student_id_fkey(first_name, last_name),
         schools!compliance_cases_school_id_fkey(name)`,
        { count: "exact" }
      )
      .eq("is_resolved", false);

    // School filter
    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    // Tier filter
    if (tier) {
      query = query.eq("current_tier", tier);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order("current_tier", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("getCaseList error:", error);
      throw error;
    }

    console.log("getCaseList: returned", data?.length, "rows, total:", count);

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Map rows and apply client-side student name search
    // (PostgREST doesn't support ilike on joined fields in the same query)
    let cases: ComplianceCaseRow[] = (data ?? []).map((c: any) => ({
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
      case_workflow_stage: c.case_workflow_stage ?? "new",
      packet_stage: c.packet_stage ?? "not_started",
      outcome_stage: c.outcome_stage ?? null,
      assigned_to: c.assigned_to ?? null,
      opened_at: c.created_at ?? new Date().toISOString(),
    }));

    // Client-side name search (search is applied client-side because
    // PostgREST doesn't support filtering on joined foreign-key columns
    // within the same .select() call)
    if (search) {
      const q = search.toLowerCase();
      cases = cases.filter((c) => c.student_name.toLowerCase().includes(q));
    }

    return {
      cases,
      total: search ? cases.length : total,
      page,
      pageSize,
      totalPages: search ? Math.ceil(cases.length / pageSize) : totalPages,
    };
  } catch (err) {
    throw handleServiceError("load compliance cases", err);
  }
}
