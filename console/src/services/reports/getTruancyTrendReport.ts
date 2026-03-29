/**
 * Fetch truancy trend / risk-signal data.
 *
 * Returns counts of students at elevated and softening risk levels,
 * plus the severe/acute attendance band count for intervention tracking.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { TruancyTrendData } from "@/types/reports";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getTruancyTrendReport(): Promise<TruancyTrendData> {
  try {
    const [{ data: signals }, { data: snapshots }] = await Promise.all([
      supabase.from("risk_signals").select("student_id, signal_level"),
      supabase
        .from("attendance_snapshots")
        .select("student_id, attendance_rate"),
    ]);

    const signalList = signals ?? [];
    const snapList = snapshots ?? [];

    const elevatedCount = signalList.filter(
      (s) => s.signal_level === "elevated"
    ).length;
    const softeningCount = signalList.filter(
      (s) => s.signal_level === "softening"
    ).length;

    // Severe (70-80%) + Acute (<70%)
    let severeOrAcuteCount = 0;
    for (const snap of snapList) {
      const rate = Number(snap.attendance_rate) ?? 100;
      if (rate < 80) severeOrAcuteCount++;
    }

    return {
      elevatedCount,
      softeningCount,
      studentsRequiringIntervention: elevatedCount + softeningCount,
      severeOrAcuteCount,
    };
  } catch (err) {
    throw handleServiceError("load truancy trend report", err);
  }
}
