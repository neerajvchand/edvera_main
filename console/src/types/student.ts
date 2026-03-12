/* ------------------------------------------------------------------ */
/* Shared student types — used by services, hooks, and components      */
/* ------------------------------------------------------------------ */

/* ---- List page --------------------------------------------------- */

export interface StudentListItem {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  school_name: string | null;
  attendance_rate: number | null;
  is_chronic_absent: boolean | null;
  days_absent: number | null;
  signal_level: string | null;
}

/* ---- Detail page — entity types ---------------------------------- */

export interface StudentBasic {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  gender: string;
  birth_date: string;
  language_fluency: string;
  school: { name: string } | null;
}

export interface Snapshot {
  days_enrolled: number;
  days_present: number;
  days_absent: number;
  days_absent_excused: number;
  days_absent_unexcused: number;
  days_tardy: number;
  days_truant: number;
  attendance_rate: number;
  ada_rate: number;
  is_chronic_absent: boolean;
}

export interface RiskSignal {
  signal_level: string;
  signal_title: string;
  signal_subtitle: string;
  attendance_rate: number;
  consecutive_absences: number;
  trend_delta: number;
  predicted_year_end_rate: number;
  last_30_rate: number | null;
  previous_30_rate: number | null;
}

export interface ComplianceCase {
  id: string;
  current_tier: string;
  unexcused_absence_count: number;
  truancy_count: number;
  total_absence_count: number;
  is_resolved: boolean;
  tier_1_triggered_at: string | null;
  tier_2_triggered_at: string | null;
  tier_3_triggered_at: string | null;
  created_at: string;
}

export interface Action {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  reason: string | null;
  priority: string;
  status: string;
  due_date: string;
  assigned_to: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  completion_data: Record<string, unknown> | null;
  compliance_case_id: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  calendar_date: string;
  canonical_type: string;
  sis_absence_code: string | null;
}

export interface InterventionEntry {
  id: string;
  intervention_type: string;
  intervention_date: string;
  description: string | null;
  outcome: string | null;
  performed_by_name: string | null;
  created_at: string;
}

/* ---- Detail page — composite response ---------------------------- */

export interface StudentDetailResponse {
  student: StudentBasic;
  snapshot: Snapshot | null;
  signal: RiskSignal | null;
  activeCase: ComplianceCase | null;
  allComplianceCases: ComplianceCase[];
  actions: Action[];
  absences: AttendanceRecord[];
  interventions: InterventionEntry[];
  allAttendance: { calendar_date: string; canonical_type: string }[];
}

/* ---- Attendance service ------------------------------------------ */

export interface MonthlyAttendance {
  month: string;
  rate: number;
  present: number;
  total: number;
}

export interface AttendanceMetrics {
  snapshot: Snapshot;
  dailyRecords: AttendanceRecord[];
  monthlyBreakdown: MonthlyAttendance[];
}
