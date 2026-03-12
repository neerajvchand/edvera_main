// SchoolPulse Data Types

export type DayType = 'normal' | 'minimum' | 'noschool';
export type UrgencyLevel = 'action' | 'note' | 'none';
export type ActionStatus = 'open' | 'done';
export type AttendanceStatus = 'present' | 'absent' | 'tardy' | 'excused';
export type AcademicAlertLevel = 'good' | 'watch' | 'concern';

export interface Child {
  id: string;
  name: string;
  schoolId: string;
  grade: string;
}

export interface School {
  id: string;
  name: string;
  district: string;
}

export interface DayInfo {
  date: string;
  type: DayType;
  pickupTime: string;
  startTime: string;
  notes?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  dueDate: string;
  dueAt?: string; // ISO 8601 timestamp for precise urgency computation
  urgency: UrgencyLevel;
  status: ActionStatus;
}

export interface UpcomingEvent {
  id: string;
  dateTimeStart: string;
  title: string;
  plainSummary: string;
  urgencyLevel: UrgencyLevel;
  source: string;
}

export interface DailyBrief {
  date: string;
  text: string;
  reasons: string[];
  sources: string[];
}

// New SIS-related types for Aeries/PowerSchool/Infinite Campus integration

export interface AttendanceRecord {
  date: string;
  status: AttendanceStatus;
  period?: string;
  reason?: string;
}

export interface AttendanceSummary {
  currentStreak: number; // consecutive present days
  totalDaysPresent: number;
  totalDaysAbsent: number;
  totalTardies: number;
  attendanceRate: number; // percentage
  recentRecords: AttendanceRecord[];
  alertLevel: 'good' | 'watch' | 'concern';
  aiInsight?: string;
}

export interface GradeInfo {
  subject: string;
  currentGrade: string;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

export interface MissingAssignment {
  id: string;
  subject: string;
  title: string;
  dueDate: string;
  daysOverdue: number;
  pointsPossible: number;
}

export interface AcademicInsight {
  id: string;
  type: 'alert' | 'celebration' | 'tip' | 'pattern';
  subject?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  source: string; // e.g., "Aeries", "PowerSchool"
  actionRequired: boolean;
}

export interface AcademicPulse {
  overallStatus: AcademicAlertLevel;
  gpa?: string;
  grades: GradeInfo[];
  missingAssignments: MissingAssignment[];
  insights: AcademicInsight[];
  lastSyncTime: string;
  aiSummary: string;
}

export interface SchoolPulseData {
  child: Child;
  school: School;
  dayInfo: DayInfo;
  actionItems: ActionItem[];
  upcomingEvents: UpcomingEvent[];
  dailyBrief: DailyBrief;
  // New SIS data
  attendance: AttendanceSummary;
  academic: AcademicPulse;
}
