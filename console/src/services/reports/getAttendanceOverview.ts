/**
 * Fetch district-level attendance overview.
 *
 * Returns aggregated attendance metrics, band distribution, and
 * per-school breakdown shaped for chart/UI consumption.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type {
  AttendanceOverviewData,
  AttendanceBandDistribution,
  SchoolAttendanceRow,
} from "@/types/reports";

/** Per-pupil daily ADA rate used for projected loss calculations. */
export const DAILY_RATE = 65;

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getAttendanceOverview(): Promise<AttendanceOverviewData> {
  try {
    const [{ data: schools }, { data: snapshots }] = await Promise.all([
      supabase.from("schools").select("id, name"),
      supabase
        .from("attendance_snapshots")
        .select(
          "student_id, school_id, days_enrolled, days_absent, days_absent_excused, days_absent_unexcused, attendance_rate, is_chronic_absent"
        ),
    ]);

    const schoolList = schools ?? [];
    const snapList = snapshots ?? [];

    const totalStudents = snapList.length;

    // Chronic rate
    const chronicStudents = snapList.filter((s) => s.is_chronic_absent);
    const chronicRate =
      totalStudents > 0 ? (chronicStudents.length / totalStudents) * 100 : 0;

    // Projected ADA loss
    const projectedLoss = snapList.reduce(
      (sum, s) => sum + (s.days_absent ?? 0) * DAILY_RATE,
      0
    );

    // Unexcused rate
    const totalAbsentDays = snapList.reduce(
      (s, r) => s + (r.days_absent ?? 0),
      0
    );
    const totalUnexcusedDays = snapList.reduce(
      (s, r) => s + (r.days_absent_unexcused ?? 0),
      0
    );
    const unexcusedRate =
      totalAbsentDays > 0
        ? (totalUnexcusedDays / totalAbsentDays) * 100
        : 0;

    // Attendance bands
    const bands: AttendanceBandDistribution = {
      satisfactory: 0,
      atRisk: 0,
      moderate: 0,
      severe: 0,
      acute: 0,
    };
    for (const snap of snapList) {
      const rate = Number(snap.attendance_rate) ?? 100;
      if (rate >= 95) bands.satisfactory++;
      else if (rate >= 90) bands.atRisk++;
      else if (rate >= 80) bands.moderate++;
      else if (rate >= 70) bands.severe++;
      else bands.acute++;
    }

    // Per-school breakdown
    const schoolMap = new Map<
      string,
      { name: string; students: number; chronicCount: number; totalAbsent: number }
    >();
    for (const sch of schoolList) {
      schoolMap.set(sch.id, {
        name: sch.name,
        students: 0,
        chronicCount: 0,
        totalAbsent: 0,
      });
    }
    for (const snap of snapList) {
      const entry = schoolMap.get(snap.school_id);
      if (entry) {
        entry.students++;
        if (snap.is_chronic_absent) entry.chronicCount++;
        entry.totalAbsent += snap.days_absent ?? 0;
      }
    }

    const schoolRows: SchoolAttendanceRow[] = [...schoolMap.entries()].map(
      ([id, d]) => ({
        id,
        name: d.name,
        students: d.students,
        chronicCount: d.chronicCount,
        chronicRate:
          d.students > 0 ? (d.chronicCount / d.students) * 100 : 0,
        projectedLoss: d.totalAbsent * DAILY_RATE,
      })
    );

    return {
      totalStudents,
      chronicRate,
      projectedLoss,
      unexcusedRate,
      bands,
      schools: schoolRows,
    };
  } catch (err) {
    throw handleServiceError("load attendance overview", err);
  }
}
