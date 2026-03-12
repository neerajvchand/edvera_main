/**
 * Fetch chronic absentee data broken down by school.
 *
 * Returns one row per school with chronic-absence counts and rates,
 * shaped for table/chart consumption.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import { DAILY_RATE } from "@/services/reports/getAttendanceOverview";
import type { ChronicAbsenteeRow } from "@/types/reports";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getChronicAbsenteeReport(): Promise<ChronicAbsenteeRow[]> {
  try {
    const [{ data: schools }, { data: snapshots }] = await Promise.all([
      supabase.from("schools").select("id, name"),
      supabase
        .from("attendance_snapshots")
        .select("student_id, school_id, days_absent, is_chronic_absent"),
    ]);

    const schoolList = schools ?? [];
    const snapList = snapshots ?? [];

    const schoolMap = new Map<
      string,
      {
        name: string;
        total: number;
        chronicCount: number;
        totalAbsent: number;
      }
    >();
    for (const sch of schoolList) {
      schoolMap.set(sch.id, {
        name: sch.name,
        total: 0,
        chronicCount: 0,
        totalAbsent: 0,
      });
    }

    for (const snap of snapList) {
      const entry = schoolMap.get(snap.school_id);
      if (entry) {
        entry.total++;
        if (snap.is_chronic_absent) entry.chronicCount++;
        entry.totalAbsent += snap.days_absent ?? 0;
      }
    }

    return [...schoolMap.entries()].map(([id, d]) => ({
      schoolId: id,
      schoolName: d.name,
      totalStudents: d.total,
      chronicCount: d.chronicCount,
      chronicRate: d.total > 0 ? (d.chronicCount / d.total) * 100 : 0,
      newlyChronicCount: d.chronicCount, // same snapshot, no delta yet
      projectedLoss: d.totalAbsent * DAILY_RATE,
    }));
  } catch (err) {
    throw handleServiceError("load chronic absentee report", err);
  }
}
