/* ------------------------------------------------------------------ */
/* Case Workspace Types                                               */
/* ------------------------------------------------------------------ */

export type TierChecklistItem = {
  key: string;
  label: string;
  completed: boolean;
  source: "action" | "document" | "manual" | "approval";
  completedAt: string | null;
};

export type ActionItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  status: "open" | "completed" | "overdue" | "blocked";
  assignedTo: { id: string; name: string } | null;
};

export type TimelineItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  color: "green" | "orange" | "red" | "purple" | "gray" | "blue";
};

export type DocumentRecord = {
  id: string;
  docType: string;
  title: string;
  generatedAt: string;
  createdAt: string;
  sentMethod: string | null;
  sentAt: string | null;
  deliveryConfirmed: boolean;
};

export type CaseWorkspaceResponse = {
  case: {
    id: string;
    studentId: string;
    studentName: string;
    schoolId: string;
    schoolName: string;
    schoolAddress: string | null;
    schoolPhone: string | null;
    principalName: string | null;
    districtId: string;
    districtName: string;
    districtAddress: string | null;
    grade: string;
    openedAt: string;
    tier: 1 | 2 | 3;
    status: string;
    signalLevel: string;
    assignedTo: { id: string; name: string; role: string } | null;
    ssid: string | null;
    preferredLanguage: string | null;
    dateOfBirth: string | null;
    /* Chunk 3 additions */
    sarbPacketStatus: "not_started" | "draft" | "ready_for_approval" | "approved" | "submitted";
    isResolved: boolean;
    resolutionType: string | null;
    resolutionNotes: string | null;
    resolvedAt: string | null;
    escalationBlockedReason: string | null;
  };
  countyOffice: {
    name: string;
    shortName: string | null;
    sarbCoordinatorName: string | null;
    sarbCoordinatorEmail: string | null;
    sarbCoordinatorPhone: string | null;
    sarbMeetingLocation: string | null;
    sarbMeetingSchedule: string | null;
    sarbReferralInstructions: string | null;
  } | null;
  metrics: {
    attendanceRate: number;
    daysEnrolled: number;
    totalAbsences: number;
    unexcusedAbsences: number;
    excusedAbsences: number;
    tardies: number;
    truancyCount: number;
    chronicBand: "satisfactory" | "at-risk" | "moderate" | "severe";
    thirtyDayRate: number | null;
    priorThirtyDayRate: number | null;
  };
  permissions: {
    canView: boolean;
    canCompleteActions: boolean;
    canGenerateDocuments: boolean;
    canSubmitSarb: boolean;
    canResolveCase: boolean;
    canApproveEscalation: boolean;
    canEditNarrative: boolean;
  };
  tierChecklist: {
    tier1: TierChecklistItem[];
    tier2: TierChecklistItem[];
    tier3: TierChecklistItem[];
  };
  actions: ActionItem[];
  documents: DocumentRecord[];
  timeline: TimelineItem[];
  rootCause: {
    assessedCount: number;
    totalCount: number;
    status: "not_started" | "in_progress" | "complete";
  } | null;
  /* Chunk 3 additions */
  rootCauseData: Record<string, unknown> | null;
  sarbApproval: {
    approvedBy: string | null;
    approvedAt: string | null;
    notes: string | null;
  } | null;
};
