/**
 * Compliance case update operations.
 *
 * Consolidates all compliance_cases mutations that were previously
 * spread across workspace components.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import { getCurrentUserId } from "@/services/auth";
import type { CaseWorkflowStage, PacketStage, OutcomeStage } from "@/lib/caseStages";

/* ------------------------------------------------------------------ */
/* Generic update                                                      */
/* ------------------------------------------------------------------ */

export async function updateCaseFields(
  caseId: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase
      .from("compliance_cases")
      .update(fields)
      .eq("id", caseId);
    if (error) throw error;
  } catch (err) {
    throw handleServiceError("update compliance case", err);
  }
}

/* ------------------------------------------------------------------ */
/* Resolve case                                                        */
/* ------------------------------------------------------------------ */

export interface ResolveCaseInput {
  resolutionType: string;
  notes: string | null;
}

export async function resolveCase(
  caseId: string,
  input: ResolveCaseInput
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("compliance_cases")
      .update({
        is_resolved: true,
        resolution_type: input.resolutionType,
        resolution_notes: input.notes,
        resolved_at: now,
        resolved_by: userId,
        case_workflow_stage: "closed",
        outcome_stage: "resolved",
      })
      .eq("id", caseId);

    if (error) throw error;
  } catch (err) {
    throw handleServiceError("resolve case", err);
  }
}

/* ------------------------------------------------------------------ */
/* SARB approval                                                       */
/* ------------------------------------------------------------------ */

export async function approveSarbPacket(
  caseId: string,
  notes?: string
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();

    await updateCaseFields(caseId, {
      sarb_packet_status: "approved",
      packet_stage: "approved",
      sarb_approved_by: userId,
      sarb_approved_at: now,
      sarb_approval_notes: notes || null,
    });
  } catch (err) {
    throw handleServiceError("approve SARB packet", err);
  }
}

export async function requestSarbChanges(
  caseId: string,
  notes: string
): Promise<void> {
  try {
    await updateCaseFields(caseId, {
      sarb_packet_status: "draft",
      sarb_approval_notes: notes || "Changes requested by principal",
    });
  } catch (err) {
    throw handleServiceError("request SARB changes", err);
  }
}

export async function submitSarbForApproval(caseId: string): Promise<void> {
  try {
    await updateCaseFields(caseId, {
      sarb_packet_status: "ready_for_approval",
      packet_stage: "under_review",
    });
  } catch (err) {
    throw handleServiceError("submit SARB for approval", err);
  }
}

export async function markSarbSubmitted(caseId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await updateCaseFields(caseId, {
      sarb_packet_status: "submitted",
      packet_stage: "submitted",
      outcome_stage: "hearing_scheduled",
      sarb_submitted_at: now,
    });
  } catch (err) {
    throw handleServiceError("mark SARB submitted", err);
  }
}

/* ------------------------------------------------------------------ */
/* Stage transitions (four-layer model)                                */
/* ------------------------------------------------------------------ */

export async function advanceCaseWorkflowStage(
  caseId: string,
  stage: CaseWorkflowStage
): Promise<void> {
  try {
    await updateCaseFields(caseId, { case_workflow_stage: stage });
  } catch (err) {
    throw handleServiceError("advance case workflow stage", err);
  }
}

export async function updatePacketStage(
  caseId: string,
  stage: PacketStage
): Promise<void> {
  try {
    await updateCaseFields(caseId, { packet_stage: stage });
  } catch (err) {
    throw handleServiceError("update packet stage", err);
  }
}

export async function updateOutcomeStage(
  caseId: string,
  stage: OutcomeStage
): Promise<void> {
  try {
    await updateCaseFields(caseId, { outcome_stage: stage });
  } catch (err) {
    throw handleServiceError("update outcome stage", err);
  }
}

/* ------------------------------------------------------------------ */
/* Root cause data                                                     */
/* ------------------------------------------------------------------ */

export async function updateRootCauseData(
  caseId: string,
  rootCauseData: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase
      .from("compliance_cases")
      .update({ root_cause_data: rootCauseData })
      .eq("id", caseId);
    if (error) throw error;
  } catch (err) {
    throw handleServiceError("save root cause data", err);
  }
}
