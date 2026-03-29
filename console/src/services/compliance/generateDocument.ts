/**
 * Document generation service for the Case Workspace.
 *
 * Handles Tier 1 letter generation: fetches absence dates, delegates PDF
 * creation to the pure generator in lib/documents/, downloads the blob,
 * and persists the record via saveDocument.
 */
import { supabase } from "@/lib/supabase";
import {
  generateTruancyNotificationLetter,
  type TruancyLetterInput,
} from "@/lib/documents/truancy-letter";
import { saveDocument } from "@/services/documents/saveDocument";
import { syncActionToTierRequirements } from "./syncActionToTierRequirements";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Tier1LetterData {
  parentName: string;
  parentAddress: string;
  deliveryMethod: string;
  preparedBy: string;
}

/* ------------------------------------------------------------------ */
/* Tier 1 Letter Generation                                            */
/* ------------------------------------------------------------------ */

export async function generateTier1Letter(
  caseId: string,
  letterData: Tier1LetterData,
  workspaceData: CaseWorkspaceResponse
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    const c = workspaceData.case;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // 1. Fetch absence dates for the letter
    const { data: absenceRows } = await supabase
      .from("attendance_daily")
      .select("calendar_date, canonical_type")
      .eq("student_id", c.studentId)
      .in("canonical_type", ["absent_unexcused", "absent_unverified"])
      .gte("calendar_date", "2025-07-01")
      .lte("calendar_date", "2026-06-30")
      .order("calendar_date", { ascending: true });

    const absenceDates = (absenceRows ?? []).map(
      (r: { calendar_date: string }) => r.calendar_date
    );

    // Parse student name parts
    const nameParts = c.studentName.split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 2. Build letter input — all from workspaceData, no hardcoded values
    const letterInput: TruancyLetterInput = {
      student: {
        firstName,
        lastName,
        grade: c.grade,
        dateOfBirth: c.dateOfBirth ?? undefined,
      },
      parent: {
        name: letterData.parentName,
        address: letterData.parentAddress,
      },
      school: {
        name: c.schoolName,
        address: c.schoolAddress ?? "",
        phone: c.schoolPhone ?? "",
        principalName: c.principalName ?? "",
      },
      district: {
        name: c.districtName,
        address: c.districtAddress ?? "",
      },
      absenceDates,
      totalUnexcused: workspaceData.metrics.unexcusedAbsences,
      letterDate: today,
      preparedBy: letterData.preparedBy,
    };

    // 3. Generate the PDF (pure function — returns Blob)
    const blob = generateTruancyNotificationLetter(letterInput);

    // 4. Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tier1_Notification_${lastName}_${firstName}_${today}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    // 5. Persist document record via saveDocument service
    const contentJson = {
      ...letterInput,
      deliveryMethod: letterData.deliveryMethod,
      generatedAt: now,
    };

    const documentId = await saveDocument({
      caseId,
      studentId: c.studentId,
      schoolId: c.schoolId,
      docType: "tier1_notification",
      title: `Tier 1 Notification — ${c.studentName}`,
      contentJson,
      sentMethod: letterData.deliveryMethod,
    });

    // 6. Trigger tier writeback for notification_sent + legal_language
    try {
      await syncActionToTierRequirements(caseId, "send_letter", {
        completedAt: now,
        method: letterData.deliveryMethod,
      });
    } catch (tierErr) {
      console.error("generateTier1Letter: tier sync error (non-fatal)", tierErr);
    }

    return { success: true, documentId };
  } catch (e) {
    console.error("generateTier1Letter: unexpected error", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error",
    };
  }
}
