/**
 * Compliance case update operations.
 *
 * Consolidates all compliance_cases mutations that were previously
 * spread across workspace components.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import { getCurrentUserId } from "@/services/auth";

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
      sarb_submitted_at: now,
    });
  } catch (err) {
    throw handleServiceError("mark SARB submitted", err);
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
