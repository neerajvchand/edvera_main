import { supabase } from "@/lib/supabase";
import type {
  CaseWorkspaceResponse,
  TierChecklistItem,
  ActionItem,
  TimelineItem,
  DocumentRecord,
  RootCauseAssessment,
  SartReferralData,
  SartMeetingRecord,
  SartFollowupRecord,
  SartActionItem,
  WorkflowStep,
  SartMeetingOutcome,
} from "@/types/caseWorkspace";
import { getSchool } from "@/services/schools/getSchool";
import { getDistrict } from "@/services/schools/getDistrict";
import { getCountyOffice } from "@/services/schools/getCountyOffice";
import type { SchoolRecord, DistrictRecord } from "@/types/organization";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function tierNumber(raw: string): 1 | 2 | 3 {
  if (raw === "tier_3_sarb_referral") return 3;
  if (raw === "tier_2_conference") return 2;
  return 1;
}

function deriveStatus(c: {
  is_resolved: boolean;
  sarb_packet_status: string | null;
  current_tier: string;
}): string {
  if (c.is_resolved) return "resolved";
  if (c.sarb_packet_status === "submitted") return "submitted";
  if (c.current_tier !== "none") return "in_progress";
  return "open";
}

function chronicBand(
  absenceRate: number
): "satisfactory" | "at-risk" | "moderate" | "severe" {
  if (absenceRate >= 20) return "severe";
  if (absenceRate >= 10) return "moderate";
  if (absenceRate >= 5) return "at-risk";
  return "satisfactory";
}

function derivePermissions(role: string | null): CaseWorkspaceResponse["permissions"] {
  switch (role) {
    case "district_admin":
      return {
        canView: true,
        canCompleteActions: true,
        canGenerateDocuments: true,
        canSubmitSarb: true,
        canResolveCase: true,
        canApproveEscalation: true,
        canEditNarrative: true,
      };
    case "principal":
      return {
        canView: true,
        canCompleteActions: true,
        canGenerateDocuments: true,
        canSubmitSarb: true,
        canResolveCase: true,
        canApproveEscalation: true,
        canEditNarrative: true,
      };
    case "attendance_clerk":
      return {
        canView: true,
        canCompleteActions: true,
        canGenerateDocuments: true,
        canSubmitSarb: false,
        canResolveCase: false,
        canApproveEscalation: false,
        canEditNarrative: true,
      };
    case "counselor":
      return {
        canView: true,
        canCompleteActions: true,
        canGenerateDocuments: false,
        canSubmitSarb: false,
        canResolveCase: false,
        canApproveEscalation: false,
        canEditNarrative: false,
      };
    default:
      return {
        canView: true,
        canCompleteActions: false,
        canGenerateDocuments: false,
        canSubmitSarb: false,
        canResolveCase: false,
        canApproveEscalation: false,
        canEditNarrative: false,
      };
  }
}

function buildTierChecklist(
  tierReqs: Record<string, unknown> | null
): CaseWorkspaceResponse["tierChecklist"] {
  const tr = tierReqs ?? {};
  const t1 = (tr.tier_1 ?? {}) as Record<string, unknown>;
  const t2 = (tr.tier_2 ?? {}) as Record<string, unknown>;
  const t3 = (tr.tier_3 ?? {}) as Record<string, unknown>;

  function extractItem(
    data: Record<string, unknown>,
    key: string,
    label: string,
    source: TierChecklistItem["source"]
  ): TierChecklistItem {
    const val = data[key];
    if (val && typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        key,
        label,
        completed: !!obj.completed,
        source,
        completedAt:
          typeof obj.completedAt === "string"
            ? obj.completedAt
            : typeof obj.date === "string"
              ? obj.date
              : null,
      };
    }
    if (typeof val === "boolean") {
      return { key, label, completed: val, source, completedAt: null };
    }
    return { key, label, completed: false, source, completedAt: null };
  }

  return {
    tier1: [
      extractItem(t1, "notification_sent", "Notification sent", "action"),
      extractItem(
        t1,
        "notification_language_compliant",
        "Legal language (EC \u00A748260.5)",
        "document"
      ),
    ],
    tier2: [
      extractItem(
        t2,
        "conference_held",
        "Conference held or attempted",
        "action"
      ),
      extractItem(t2, "resources_offered", "Resources offered", "action"),
      extractItem(
        t2,
        "consequences_explained",
        "Consequences explained (EC \u00A748262)",
        "action"
      ),
    ],
    tier3: [
      extractItem(t3, "packet_assembled", "Packet assembled", "document"),
      extractItem(
        t3,
        "prior_tiers_documented",
        "Prior tiers documented",
        "approval"
      ),
      extractItem(t3, "referral_submitted", "Referral submitted", "document"),
    ],
  };
}

/** Build timeline from actions, interventions, documents, and case events */
function buildTimeline(
  caseRow: Record<string, unknown>,
  actions: Array<Record<string, unknown>>,
  interventions: Array<Record<string, unknown>>,
  documents: Array<Record<string, unknown>>
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Case creation
  if (caseRow.created_at) {
    items.push({
      id: `case-created-${caseRow.id as string}`,
      type: "case_opened",
      title: "Case opened",
      description: `Tier: ${caseRow.current_tier as string}`,
      createdAt: caseRow.created_at as string,
      color: "blue",
    });
  }

  // Tier transitions
  const tierEvents: Array<{
    field: string;
    title: string;
    color: TimelineItem["color"];
  }> = [
    {
      field: "tier_1_triggered_at",
      title: "Tier 1 triggered",
      color: "orange",
    },
    {
      field: "tier_1_letter_sent_at",
      title: "Tier 1 letter sent",
      color: "green",
    },
    {
      field: "tier_2_triggered_at",
      title: "Tier 2 triggered",
      color: "orange",
    },
    {
      field: "tier_3_triggered_at",
      title: "Tier 3 triggered",
      color: "red",
    },
  ];

  for (const te of tierEvents) {
    const dt = caseRow[te.field];
    if (dt && typeof dt === "string") {
      items.push({
        id: `tier-${te.field}-${caseRow.id as string}`,
        type: "tier_transition",
        title: te.title,
        description: null,
        createdAt: dt,
        color: te.color,
      });
    }
  }

  // Resolution
  if (caseRow.is_resolved && caseRow.resolved_at) {
    items.push({
      id: `resolved-${caseRow.id as string}`,
      type: "case_resolved",
      title: "Case resolved",
      description: (caseRow.resolution_notes as string) ?? null,
      createdAt: caseRow.resolved_at as string,
      color: "green",
    });
  }

  // Actions — completed get green, created/deferred/open get gray
  for (const a of actions) {
    const status = a.status as string;
    let actionColor: TimelineItem["color"] = "gray";
    if (status === "completed") actionColor = "green";

    items.push({
      id: `action-${a.id as string}`,
      type: status === "completed" ? "action_completed" : "action_created",
      title: a.title as string,
      description:
        status === "completed"
          ? "Completed"
          : status === "deferred"
            ? "Deferred"
            : (status as string),
      createdAt: (a.completed_at ?? a.created_at) as string,
      color: actionColor,
    });
  }

  // Interventions
  for (const i of interventions) {
    items.push({
      id: `intervention-${i.id as string}`,
      type: "intervention_logged",
      title: `Intervention: ${i.intervention_type as string}`,
      description: (i.description as string) ?? null,
      createdAt: i.created_at as string,
      color: "purple",
    });
  }

  // Documents
  for (const d of documents) {
    items.push({
      id: `doc-${d.id as string}`,
      type: "document_generated",
      title: d.title as string,
      description: `Type: ${(d.doc_type as string).replace(/_/g, " ")}`,
      createdAt: (d.generated_at ?? d.created_at) as string,
      color: "green",
    });
  }

  // Sort newest first
  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return items.slice(0, 50);
}

function computeRootCause(
  rootCauseData: Record<string, unknown> | null
): CaseWorkspaceResponse["rootCause"] {
  if (!rootCauseData) return { assessedCount: 0, totalCount: 23, status: "not_started" };
  let assessed = 0;
  // Walk all domains and their questions
  for (const domainKey of Object.keys(rootCauseData)) {
    const domain = rootCauseData[domainKey];
    if (domain && typeof domain === "object") {
      for (const qKey of Object.keys(domain as Record<string, unknown>)) {
        const val = (domain as Record<string, unknown>)[qKey];
        if (val !== null && val !== undefined && val !== "unknown") {
          assessed++;
        }
      }
    }
  }
  const status =
    assessed === 0 ? "not_started" : assessed >= 23 ? "complete" : "in_progress";
  return { assessedCount: assessed, totalCount: 23, status };
}

/* ------------------------------------------------------------------ */
/* SART data parsing                                                   */
/* ------------------------------------------------------------------ */

function parseRootCauseAssessment(
  raw: unknown,
): RootCauseAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.categories || !obj.narrative) return null;
  return {
    categories: obj.categories as RootCauseAssessment["categories"],
    narrative: obj.narrative as string,
    savedAt: (obj.savedAt as string) ?? null,
    savedBy: (obj.savedBy as string) ?? null,
  };
}

function parseSartData(raw: unknown): SartReferralData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.referral_trigger || !obj.referral_date) return null;
  return {
    referral_trigger: obj.referral_trigger as SartReferralData["referral_trigger"],
    referral_date: obj.referral_date as string,
    prior_informal_interventions: (obj.prior_informal_interventions as string) ?? "",
    referred_by: (obj.referred_by as string) ?? "",
    savedAt: (obj.savedAt as string) ?? null,
  };
}

function parseSartMeeting(
  interventions: Array<Record<string, unknown>>,
): SartMeetingRecord | null {
  const meeting = interventions.find(
    (i) => i.intervention_type === "sart_meeting",
  );
  if (!meeting) return null;
  const meta = (meeting.metadata ?? {}) as Record<string, unknown>;
  return {
    id: meeting.id as string,
    meeting_date: meeting.intervention_date as string,
    attendees: (meta.attendees as string[]) ?? [],
    family_present: !!(meta.family_present as boolean),
    agenda_checklist: (meta.agenda_checklist as Record<string, boolean>) ?? {},
    outcome: (meeting.outcome as SartMeetingOutcome) ?? "action_plan_agreed",
    notes: (meeting.description as string) ?? "",
    createdAt: meeting.created_at as string,
  };
}

function parseSartFollowup(
  interventions: Array<Record<string, unknown>>,
): SartFollowupRecord | null {
  const followup = interventions.find(
    (i) => i.intervention_type === "sart_followup",
  );
  if (!followup) return null;
  const meta = (followup.metadata ?? {}) as Record<string, unknown>;
  return {
    id: followup.id as string,
    followup_date: followup.intervention_date as string,
    attendance_improved: (meta.attendance_improved as SartFollowupRecord["attendance_improved"]) ?? "no",
    action_items_completed: (meta.action_items_completed as Record<string, boolean>) ?? {},
    outcome: (followup.outcome as SartFollowupRecord["outcome"]) ?? "continue_monitoring",
    notes: (followup.description as string) ?? "",
    createdAt: followup.created_at as string,
  };
}

function parseSartActionPlan(
  actions: Array<Record<string, unknown>>,
): SartActionItem[] {
  return actions
    .filter((a) => a.action_type === "sart_action")
    .map((a) => ({
      id: a.id as string,
      description: a.title as string,
      assigned_role: ((a.description as string) ?? "").replace("Assigned to: ", ""),
      due_date: a.due_date as string,
      completed: a.status === "completed",
      completed_at: (a.completed_at as string) ?? null,
      completed_by_name: (a.completed_by_name as string) ?? null,
    }));
}

/**
 * Builds the 8-step workflow sequence with status and blocking reasons.
 * Handles SART meeting outcome branching:
 * - close_case → steps 6+7 are skipped (status = "complete" with note)
 * - escalate_sarb → steps 6+7 still required before SARB
 * - action_plan_agreed → normal flow
 */
function buildWorkflowSteps(
  tierChecklist: CaseWorkspaceResponse["tierChecklist"],
  rootCauseAssessment: RootCauseAssessment | null,
  sartData: SartReferralData | null,
  sartMeeting: SartMeetingRecord | null,
  sartActionPlan: SartActionItem[],
  sartFollowup: SartFollowupRecord | null,
): WorkflowStep[] {
  const t1Notif = tierChecklist.tier1.find((i) => i.key === "notification_sent");
  const t2Conf = tierChecklist.tier2.find((i) => i.key === "conference_held");

  const letterComplete = !!t1Notif?.completed;
  const rcComplete =
    rootCauseAssessment !== null &&
    Object.values(rootCauseAssessment.categories).some((c) => c.checked) &&
    (rootCauseAssessment.narrative?.length ?? 0) >= 50;
  const sartReferralComplete = sartData !== null;
  const sartMeetingComplete = sartMeeting !== null;
  const conferenceComplete = !!t2Conf?.completed;
  const meetingOutcome = sartMeeting?.outcome ?? null;
  const closedAtMeeting = meetingOutcome === "close_case";
  const sartPlanComplete = closedAtMeeting || sartActionPlan.length > 0;
  const sartFollowupComplete = closedAtMeeting || sartFollowup !== null;
  const followupEscalates = sartFollowup?.outcome === "escalate_sarb";

  function step(
    key: string,
    tier: 1 | 2 | 3,
    label: string,
    isComplete: boolean,
    completedAt: string | null,
    completedBy: string | null,
    prereqs: Array<{ met: boolean; reason: string }>,
  ): WorkflowStep {
    const blockingReasons = prereqs
      .filter((p) => !p.met)
      .map((p) => p.reason);
    let status: WorkflowStep["status"] = "locked";
    if (isComplete) {
      status = "complete";
    } else if (blockingReasons.length === 0) {
      status = "active";
    }
    return { key, tier, label, status, completedAt, completedBy, blockingReasons };
  }

  const steps: WorkflowStep[] = [
    // Step 1: Truancy letter (Tier 1) — no prereqs
    step("truancy_letter", 1, "Truancy Letter Sent", letterComplete,
      t1Notif?.completedAt ?? null, null, []),

    // Step 2: Root cause assessment (Tier 1) — requires letter
    step("root_cause_assessment", 1, "Root Cause Assessment", rcComplete,
      rootCauseAssessment?.savedAt ?? null, rootCauseAssessment?.savedBy ?? null,
      [{ met: letterComplete, reason: "Truancy letter must be sent first" }]),

    // Step 3: SART referral (Tier 1) — requires letter + root cause
    step("sart_referral", 1, "SART Referral Logged", sartReferralComplete,
      sartData?.savedAt ?? null, null,
      [
        { met: letterComplete, reason: "Truancy letter must be sent first" },
        { met: rcComplete, reason: "Root cause assessment must be completed" },
      ]),

    // Step 4: SART meeting (Tier 2) — requires all Tier 1 steps
    step("sart_meeting", 2, "SART Meeting Held", sartMeetingComplete,
      sartMeeting?.createdAt ?? null, null,
      [
        { met: letterComplete, reason: "Truancy letter must be sent first" },
        { met: rcComplete, reason: "Root cause assessment must be completed" },
        { met: sartReferralComplete, reason: "SART referral must be logged" },
      ]),

    // Step 5: Parent conference (Tier 2) — requires SART meeting
    step("parent_conference", 2, "Parent/Guardian Conference", conferenceComplete,
      t2Conf?.completedAt ?? null, null,
      [
        { met: sartMeetingComplete, reason: "SART meeting must be held first" },
      ]),

    // Step 6: SART action plan (Tier 2) — requires SART meeting
    // Skipped if meeting outcome = close_case
    step("sart_action_plan", 2,
      closedAtMeeting ? "SART Action Plan (Skipped — case closed at SART meeting)" : "SART Action Plan",
      sartPlanComplete,
      closedAtMeeting ? sartMeeting?.createdAt ?? null : (sartActionPlan.length > 0 ? sartActionPlan[0].due_date : null),
      null,
      closedAtMeeting ? [] : [
        { met: sartMeetingComplete, reason: "SART meeting must be held first" },
        { met: conferenceComplete, reason: "Parent conference must be completed" },
      ]),

    // Step 7: 30-day follow-up (Tier 2) — requires action plan
    // Skipped if meeting outcome = close_case
    step("sart_followup", 2,
      closedAtMeeting ? "30-Day Follow-up (Skipped — case closed at SART meeting)" : "30-Day Follow-up",
      sartFollowupComplete,
      sartFollowup?.createdAt ?? null, null,
      closedAtMeeting ? [] : [
        { met: sartPlanComplete, reason: "SART action plan must be created" },
      ]),

    // Step 8: SARB packet (Tier 3) — requires all 7 prior steps + follow-up = escalate_sarb
    step("sarb_packet", 3, "SARB Packet", false, null, null,
      [
        { met: letterComplete, reason: "Truancy letter not sent" },
        { met: rcComplete, reason: "Root cause assessment not documented" },
        { met: sartReferralComplete, reason: "SART referral not logged" },
        { met: sartMeetingComplete, reason: "SART meeting not held" },
        { met: conferenceComplete, reason: "Parent conference not completed" },
        { met: sartPlanComplete, reason: "SART action plan not created" },
        { met: followupEscalates || closedAtMeeting, reason: "30-day follow-up must recommend SARB escalation" },
      ]),
  ];

  return steps;
}

/* ------------------------------------------------------------------ */
/* Main Service Function                                               */
/* ------------------------------------------------------------------ */

export async function getCaseWorkspace(
  caseId: string,
  userId: string
): Promise<CaseWorkspaceResponse> {
  // 1. Fetch case first (we need student_id, school_id for subsequent queries)
  const { data: caseRow, error: caseError } = await supabase
    .from("compliance_cases")
    .select(
      `id, student_id, school_id, academic_year, current_tier,
       unexcused_absence_count, truancy_count, total_absence_count,
       tier_1_triggered_at, tier_1_letter_sent_at, tier_2_triggered_at,
       tier_2_conference_date, tier_3_triggered_at, tier_3_referral_date,
       is_resolved, resolution_type, resolution_notes, resolved_at,
       tier_requirements, sarb_packet_status, root_cause_data,
       root_cause, sart_data,
       sarb_approved_by, sarb_approved_at, sarb_approval_notes,
       resolved_by, escalation_blocked_reason,
       created_at, updated_at`
    )
    .eq("id", caseId)
    .single();

  if (caseError || !caseRow) {
    throw new Error("Failed to load compliance case");
  }

  // 2. Parallel fetch everything else
  const [
    studentResult,
    school,
    profileResult,
    actionsResult,
    allActionsResult,
    interventionsResult,
    documentsResult,
    attendanceResult,
    signalResult,
  ] = await Promise.all([
    // Student
    supabase
      .from("students")
      .select(
        "first_name, last_name, grade_level, birth_date, state_student_id, correspondence_language, school_id"
      )
      .eq("id", caseRow.student_id)
      .single(),
    // School — via service
    getSchool(caseRow.school_id).catch(() => null),
    // Profile (current user)
    supabase
      .from("profiles")
      .select("id, user_id, display_name, role")
      .eq("user_id", userId)
      .single(),
    // Open actions
    supabase
      .from("actions")
      .select(
        "id, action_type, title, description, priority, due_date, status, assigned_to, created_at, completed_at"
      )
      .eq("compliance_case_id", caseId)
      .neq("status", "completed")
      .order("due_date", { ascending: true }),
    // All actions (for timeline)
    supabase
      .from("actions")
      .select("id, action_type, title, description, status, due_date, created_at, completed_at, completed_by_name")
      .eq("compliance_case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50),
    // Interventions
    supabase
      .from("intervention_log")
      .select("id, intervention_type, intervention_date, description, outcome, performed_by_name, metadata, created_at")
      .eq("compliance_case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50),
    // Documents
    supabase
      .from("compliance_documents")
      .select("id, doc_type, title, generated_at, created_at, sent_method, sent_at, delivery_confirmed")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50),
    // Attendance for current school year
    supabase
      .from("attendance_daily")
      .select("id, calendar_date, canonical_type, counts_as_truancy")
      .eq("student_id", caseRow.student_id)
      .gte("calendar_date", "2025-07-01")
      .lte("calendar_date", "2026-06-30"),
    // Risk signal
    supabase
      .from("risk_signals")
      .select("signal_level, last_30_rate, previous_30_rate")
      .eq("student_id", caseRow.student_id)
      .maybeSingle(),
  ]);

  const student = studentResult.data;
  const profile = profileResult.data;

  // Fetch district + county office via services
  const districtId = school?.district_id ?? null;
  let district: DistrictRecord | null = null;
  let countyOffice: CaseWorkspaceResponse["countyOffice"] = null;

  if (districtId) {
    district = await getDistrict(districtId).catch(() => null);

    if (district?.county_office_id) {
      const coRecord = await getCountyOffice(district.county_office_id).catch(() => null);
      if (coRecord) {
        countyOffice = {
          name: coRecord.name,
          shortName: coRecord.short_name ?? null,
          sarbCoordinatorName: coRecord.sarb_coordinator_name ?? null,
          sarbCoordinatorEmail: coRecord.sarb_coordinator_email ?? null,
          sarbCoordinatorPhone: coRecord.sarb_coordinator_phone ?? null,
          sarbMeetingLocation: coRecord.sarb_meeting_location ?? null,
          sarbMeetingSchedule: coRecord.sarb_meeting_schedule ?? null,
          sarbReferralInstructions: coRecord.sarb_referral_instructions ?? null,
        };
      }
    }
  }

  // Compute attendance metrics
  const attendanceRows = attendanceResult.data ?? [];
  const daysEnrolled = attendanceRows.length;
  let totalAbsences = 0;
  let unexcusedAbsences = 0;
  let excusedAbsences = 0;
  let tardies = 0;
  let truancyCount = 0;

  for (const row of attendanceRows) {
    const ct = row.canonical_type as string;
    if (
      ct === "absent_unexcused" ||
      ct === "absent_excused" ||
      ct === "absent_unverified" ||
      ct === "suspension_in_school" ||
      ct === "suspension_out_of_school"
    ) {
      totalAbsences++;
    }
    if (ct === "absent_unexcused" || ct === "absent_unverified") {
      unexcusedAbsences++;
    }
    if (ct === "absent_excused") {
      excusedAbsences++;
    }
    if (ct === "tardy" || ct === "tardy_excused" || ct === "tardy_unexcused") {
      tardies++;
    }
    if (row.counts_as_truancy) {
      truancyCount++;
    }
  }

  const absenceRate = daysEnrolled > 0 ? (totalAbsences / daysEnrolled) * 100 : 0;
  const attendanceRate = daysEnrolled > 0 ? 100 - absenceRate : 100;

  // 30-day rates from risk_signals
  const signal = signalResult.data;
  const thirtyDayRate =
    signal?.last_30_rate != null ? Number(signal.last_30_rate) : null;
  const priorThirtyDayRate =
    signal?.previous_30_rate != null ? Number(signal.previous_30_rate) : null;

  // Build open actions list
  const openActions: ActionItem[] = (actionsResult.data ?? []).map(
    (a: Record<string, unknown>) => {
      const dueDate = a.due_date as string | null;
      let status: ActionItem["status"] = "open";
      if (a.status === "completed") status = "completed";
      else if (a.status === "blocked") status = "blocked";
      else if (dueDate && new Date(dueDate) < new Date()) status = "overdue";

      return {
        id: a.id as string,
        type: a.action_type as string,
        title: a.title as string,
        description: (a.description as string) ?? null,
        priority: (["low", "medium", "high", "urgent"].includes(
          a.priority as string
        )
          ? a.priority
          : "medium") as ActionItem["priority"],
        dueDate: dueDate ?? null,
        status,
        assignedTo: null,
      };
    }
  );

  // Build timeline
  const timeline = buildTimeline(
    caseRow as unknown as Record<string, unknown>,
    (allActionsResult.data ?? []) as Array<Record<string, unknown>>,
    (interventionsResult.data ?? []) as Array<Record<string, unknown>>,
    (documentsResult.data ?? []) as Array<Record<string, unknown>>
  );

  // Build school address fallback
  const schoolAddress =
    school?.address ??
    (school?.address_street
      ? `${school.address_street}, ${school.address_city ?? ""}, ${school.address_state ?? "CA"} ${school.address_zip ?? ""}`.trim()
      : null);

  // Build response
  const result: CaseWorkspaceResponse = {
    case: {
      id: caseRow.id,
      studentId: caseRow.student_id,
      studentName: student
        ? `${student.first_name} ${student.last_name}`
        : "Unknown Student",
      schoolId: caseRow.school_id,
      schoolName: school?.name ?? "Unknown School",
      schoolAddress,
      schoolPhone: school?.phone ?? null,
      principalName: school?.principal_name ?? null,
      districtId: districtId ?? "",
      districtName: district?.name ?? "Unknown District",
      districtAddress: district?.address ?? null,
      grade: student?.grade_level ?? "—",
      openedAt: caseRow.created_at,
      tier: tierNumber(caseRow.current_tier),
      status: deriveStatus(caseRow),
      signalLevel: (signal?.signal_level as string) ?? "stable",
      assignedTo: null,
      ssid: student?.state_student_id ?? null,
      preferredLanguage: student?.correspondence_language ?? null,
      dateOfBirth: student?.birth_date ?? null,
      sarbPacketStatus: (caseRow.sarb_packet_status ?? "not_started") as CaseWorkspaceResponse["case"]["sarbPacketStatus"],
      isResolved: !!caseRow.is_resolved,
      resolutionType: (caseRow.resolution_type as string) ?? null,
      resolutionNotes: (caseRow.resolution_notes as string) ?? null,
      resolvedAt: (caseRow.resolved_at as string) ?? null,
      escalationBlockedReason: (caseRow.escalation_blocked_reason as string) ?? null,
    },
    countyOffice,
    metrics: {
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      daysEnrolled,
      totalAbsences,
      unexcusedAbsences,
      excusedAbsences,
      tardies,
      truancyCount,
      chronicBand: chronicBand(absenceRate),
      thirtyDayRate,
      priorThirtyDayRate,
    },
    permissions: derivePermissions(profile?.role ?? null),
    tierChecklist: buildTierChecklist(
      caseRow.tier_requirements as Record<string, unknown> | null
    ),
    actions: openActions,
    documents: (documentsResult.data ?? []).map(
      (d: Record<string, unknown>): DocumentRecord => ({
        id: d.id as string,
        docType: d.doc_type as string,
        title: d.title as string,
        generatedAt: (d.generated_at ?? d.created_at) as string,
        createdAt: d.created_at as string,
        sentMethod: (d.sent_method as string) ?? null,
        sentAt: (d.sent_at as string) ?? null,
        deliveryConfirmed: !!(d.delivery_confirmed as boolean),
      })
    ),
    timeline,
    rootCause: computeRootCause(
      caseRow.root_cause_data as Record<string, unknown> | null
    ),
    rootCauseData: (caseRow.root_cause_data as Record<string, unknown>) ?? null,
    sarbApproval: caseRow.sarb_approved_by
      ? {
          approvedBy: caseRow.sarb_approved_by as string,
          approvedAt: (caseRow.sarb_approved_at as string) ?? null,
          notes: (caseRow.sarb_approval_notes as string) ?? null,
        }
      : null,
    /* SART workflow fields */
    rootCauseAssessment: parseRootCauseAssessment(caseRow.root_cause),
    sartData: parseSartData(caseRow.sart_data),
    sartMeeting: parseSartMeeting(
      (interventionsResult.data ?? []) as Array<Record<string, unknown>>,
    ),
    sartFollowup: parseSartFollowup(
      (interventionsResult.data ?? []) as Array<Record<string, unknown>>,
    ),
    sartActionPlan: parseSartActionPlan(
      (allActionsResult.data ?? []) as Array<Record<string, unknown>>,
    ),
    districtToolkit:
      district?.toolkit_url && district?.toolkit_name
        ? { url: district.toolkit_url, name: district.toolkit_name }
        : null,
    workflowSteps: [], // placeholder — computed below
  };

  // Compute workflow steps (needs the built tierChecklist + SART data)
  result.workflowSteps = buildWorkflowSteps(
    result.tierChecklist,
    result.rootCauseAssessment,
    result.sartData,
    result.sartMeeting,
    result.sartActionPlan,
    result.sartFollowup,
  );

  return result;
}
