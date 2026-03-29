/* ------------------------------------------------------------------ */
/* Shared action types — used by services, hooks, and components       */
/* ------------------------------------------------------------------ */

/* ---- List page --------------------------------------------------- */

export interface ActionListItem {
  id: string;
  student_id: string;
  school_id: string;
  compliance_case_id: string | null;
  action_type: string;
  title: string;
  reason: string | null;
  priority: string;
  status: string;
  due_date: string;
  completed_at: string | null;
  completion_outcome: string | null;
  created_at: string;
  student_name: string;
  school_name: string;
}

/* ---- Stats ------------------------------------------------------- */

export interface ActionStats {
  totalOpen: number;
  overdue: number;
  urgent: number;
  completedToday: number;
}

/* ---- Completion -------------------------------------------------- */

export type ActionCompletionData = {
  completedAt: string;
  notes?: string;
  outcome?: string;
  conferenceDate?: string;
  conferenceStatus?: string;
  attendees?: string[];
  resourcesOffered?: boolean;
  ec48262Notified?: boolean;
  commitmentsMade?: string;
  followUpDate?: string;
  method?: string;
  trackingNumber?: string;
};
