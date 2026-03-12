/**
 * Fetch all compliance documents for a given case.
 *
 * Returns DocumentRecord[] matching the shape used by the workspace UI.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { DocumentRecord } from "@/types/caseWorkspace";

export async function getDocumentsByCase(
  caseId: string
): Promise<DocumentRecord[]> {
  try {
    const { data, error } = await supabase
      .from("compliance_documents")
      .select(
        "id, doc_type, title, generated_at, created_at, sent_method, sent_at, delivery_confirmed"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((d) => ({
      id: d.id,
      docType: d.doc_type,
      title: d.title,
      generatedAt: d.generated_at,
      createdAt: d.created_at,
      sentMethod: d.sent_method ?? null,
      sentAt: d.sent_at ?? null,
      deliveryConfirmed: !!d.delivery_confirmed,
    }));
  } catch (err) {
    throw handleServiceError("load documents", err);
  }
}
