import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type {
  Snapshot,
  AttendanceRecord,
  AttendanceMetrics,
  MonthlyAttendance,
} from "@/types/student";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Build monthly attendance breakdown from daily records.
 */
function buildMonthlyBreakdown(
  records: { calendar_date: string; canonical_type: string }[]
): MonthlyAttendance[] {
  const buckets = new Map<string, { present: number; total: number }>();

  for (const rec of records) {
    const d = new Date(rec.calendar_date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { present: 0, total: 0 };
    bucket.total++;
    if (rec.canonical_type === "present") bucket.present++;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      month: MONTH_NAMES[parseInt(key.split("-")[1])],
      rate:
        val.total > 0
          ? Math.round((val.present / val.total) * 1000) / 10
          : 0,
      present: val.present,
      total: val.total,
    }));
}

/**
 * Fetch attendance metrics for a single student.
 * Returns snapshot, daily absence records, and monthly breakdown.
 */
export async function getStudentAttendance(
  studentId: string
): Promise<AttendanceMetrics | null> {
  try {
    const [
      { data: snap, error: snapErr },
      { data: dailyRaw, error: dailyErr },
      { data: allDaily, error: allErr },
    ] = await Promise.all([
      supabase
        .from("attendance_snapshots")
        .select("*")
        .eq("student_id", studentId)
        .single(),
      supabase
        .from("attendance_daily")
        .select("id, calendar_date, canonical_type, sis_absence_code")
        .eq("student_id", studentId)
        .neq("canonical_type", "present")
        .order("calendar_date", { ascending: false })
        .limit(500),
      supabase
        .from("attendance_daily")
        .select("calendar_date, canonical_type")
        .eq("student_id", studentId)
        .order("calendar_date", { ascending: true }),
    ]);

    if (snapErr) throw snapErr;
    if (!snap) return null;

    if (dailyErr) console.error("Failed to load daily records:", dailyErr);
    if (allErr) console.error("Failed to load monthly data:", allErr);

    return {
      snapshot: snap as Snapshot,
      dailyRecords: (dailyRaw as AttendanceRecord[] | null) ?? [],
      monthlyBreakdown: buildMonthlyBreakdown(allDaily ?? []),
    };
  } catch (err) {
    throw handleServiceError("load student attendance", err);
  }
}
