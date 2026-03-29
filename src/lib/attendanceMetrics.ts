import { AttendanceRecord } from "@/types/schoolpulse";

export interface AttendanceMetrics {
  attendance_rate: number;
  consecutive_absences: number;
  total_days_recorded: number;
  last_30_rate: number;
  previous_30_rate: number;
  trend_delta: number;
  is_chronic_risk: boolean;
}

/**
 * Compute attendance metrics including 30-day trend detection.
 * Records should be sorted chronologically (oldest first).
 * Chronic risk = attendance rate below 90% (CA standard).
 */
export function computeAttendanceMetrics(
  records: AttendanceRecord[]
): AttendanceMetrics {
  const total = records.length;
  if (total === 0) {
    return {
      attendance_rate: 100,
      consecutive_absences: 0,
      total_days_recorded: 0,
      last_30_rate: 100,
      previous_30_rate: 100,
      trend_delta: 0,
      is_chronic_risk: false,
    };
  }

  const now = new Date();

  // Partition records into last-30 and previous-30 windows
  const last30: AttendanceRecord[] = [];
  const prev30: AttendanceRecord[] = [];

  for (const r of records) {
    const d = new Date(`${r.date}T00:00:00`);
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (daysAgo <= 30) last30.push(r);
    else if (daysAgo <= 60) prev30.push(r);
  }

  const rate = (subset: AttendanceRecord[]) => {
    if (subset.length === 0) return 100;
    const present = subset.filter(
      (r) => r.status === "present" || r.status === "excused" || r.status === "tardy"
    ).length;
    return (present / subset.length) * 100;
  };

  const overallPresent = records.filter(
    (r) => r.status === "present" || r.status === "excused" || r.status === "tardy"
  ).length;
  const attendance_rate = (overallPresent / total) * 100;

  // Consecutive absences from most recent day backwards
  const sorted = [...records].sort(
    (a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime()
  );
  let consecutive_absences = 0;
  for (const r of sorted) {
    if (r.status === "absent") consecutive_absences++;
    else break;
  }

  const last_30_rate = rate(last30);
  const previous_30_rate = rate(prev30);

  return {
    attendance_rate: Math.round(attendance_rate * 10) / 10,
    consecutive_absences,
    total_days_recorded: total,
    last_30_rate: Math.round(last_30_rate * 10) / 10,
    previous_30_rate: Math.round(previous_30_rate * 10) / 10,
    trend_delta: Math.round((last_30_rate - previous_30_rate) * 10) / 10,
    is_chronic_risk: attendance_rate < 90,
  };
}
