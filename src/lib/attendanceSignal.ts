import type { AttendanceMetrics } from "@/lib/attendanceMetrics";

export type AttendanceSignalLevel = "pending" | "stable" | "softening" | "elevated";

export interface AttendanceSignal {
  level: AttendanceSignalLevel;
  title: string;
  subtitle: string;
  next_step: string | null;
  metrics_summary: {
    rate: number;
    days_count: number;
    consecutive_absences: number;
  };
}

/**
 * Single authoritative state machine for attendance signals.
 * Priority: pending → elevated → softening → stable.
 *
 * Metrics use percentages (0–100) internally; thresholds here
 * are expressed in the same scale for clarity.
 */
export function buildAttendanceSignal(metrics: AttendanceMetrics): AttendanceSignal {
  const summary = {
    rate: metrics.attendance_rate,
    days_count: metrics.total_days_recorded,
    consecutive_absences: metrics.consecutive_absences,
  };

  // A) pending
  if (metrics.total_days_recorded < 5) {
    return {
      level: "pending",
      title: "Trend evaluation pending",
      subtitle: "Additional school days required to assess pattern.",
      next_step: null,
      metrics_summary: summary,
    };
  }

  // B) elevated
  if (metrics.attendance_rate < 90 || metrics.consecutive_absences >= 3) {
    return {
      level: "elevated",
      title: "Risk elevated",
      subtitle: "Attendance below recommended threshold.",
      next_step: "Review recent absences.",
      metrics_summary: summary,
    };
  }

  // C) softening
  if (
    (metrics.attendance_rate >= 90 && metrics.attendance_rate < 95) ||
    metrics.trend_delta <= -5
  ) {
    return {
      level: "softening",
      title: "Trend softening",
      subtitle: "Recent absences increasing relative to baseline.",
      next_step: null,
      metrics_summary: summary,
    };
  }

  // D) stable
  return {
    level: "stable",
    title: "Attendance stable",
    subtitle: "No significant change detected.",
    next_step: null,
    metrics_summary: summary,
  };
}
