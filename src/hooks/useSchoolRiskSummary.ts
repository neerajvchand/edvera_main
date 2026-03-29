import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeAttendanceMetrics, type AttendanceMetrics } from "@/lib/attendanceMetrics";
import { buildAttendanceSignal, type AttendanceSignal } from "@/lib/attendanceSignal";
import type { AttendanceRecord } from "@/types/schoolpulse";

export interface StudentRisk {
  childId: string;
  displayName: string;
  gradeLevel: string;
  signal: AttendanceSignal;
  metrics: AttendanceMetrics;
}

export interface SchoolRiskSummary {
  elevated: StudentRisk[];
  softening: StudentRisk[];
  stable: StudentRisk[];
  pending: StudentRisk[];
  totalStudents: number;
  isLoading: boolean;
}

async function fetchSchoolRisk(schoolId: string): Promise<Omit<SchoolRiskSummary, "isLoading">> {
  // 1. Fetch all active children at this school
  const { data: children, error: childErr } = await supabase
    .from("children")
    .select("id, display_name, grade_level, school_id")
    .eq("school_id", schoolId)
    .eq("is_active", true);

  if (childErr) throw childErr;
  if (!children || children.length === 0) {
    return { elevated: [], softening: [], stable: [], pending: [], totalStudents: 0 };
  }

  const childIds = children.map((c) => c.id);

  // 2. Fetch all attendance entries for those children
  const { data: entries, error: entryErr } = await supabase
    .from("attendance_entries")
    .select("*")
    .in("child_id", childIds);

  if (entryErr) throw entryErr;

  // 3. Group entries by child_id
  const entriesByChild = new Map<string, AttendanceRecord[]>();
  for (const e of entries ?? []) {
    const records = entriesByChild.get(e.child_id) ?? [];
    records.push({
      date: e.attendance_date,
      status: e.status as AttendanceRecord["status"],
      reason: e.reason ?? undefined,
      period: e.period ?? undefined,
    });
    entriesByChild.set(e.child_id, records);
  }

  // 4. Compute metrics & signal per child
  const buckets: Record<"elevated" | "softening" | "stable" | "pending", StudentRisk[]> = {
    elevated: [],
    softening: [],
    stable: [],
    pending: [],
  };

  for (const child of children) {
    const records = entriesByChild.get(child.id) ?? [];
    const metrics = computeAttendanceMetrics(records);
    const signal = buildAttendanceSignal(metrics);

    const risk: StudentRisk = {
      childId: child.id,
      displayName: child.display_name,
      gradeLevel: child.grade_level,
      signal,
      metrics,
    };

    buckets[signal.level].push(risk);
  }

  // 5. Sort
  buckets.elevated.sort((a, b) => a.metrics.attendance_rate - b.metrics.attendance_rate);
  buckets.softening.sort((a, b) => a.metrics.trend_delta - b.metrics.trend_delta);

  return { ...buckets, totalStudents: children.length };
}

export function useSchoolRiskSummary(schoolId: string | null): SchoolRiskSummary {
  const query = useQuery({
    queryKey: ["school-risk-summary", schoolId],
    queryFn: () => fetchSchoolRisk(schoolId!),
    enabled: !!schoolId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return {
    elevated: query.data?.elevated ?? [],
    softening: query.data?.softening ?? [],
    stable: query.data?.stable ?? [],
    pending: query.data?.pending ?? [],
    totalStudents: query.data?.totalStudents ?? 0,
    isLoading: query.isLoading,
  };
}
