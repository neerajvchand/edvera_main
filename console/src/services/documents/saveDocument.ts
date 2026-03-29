/**
 * Persists a generated document record to compliance_documents.
 *
 * Uses an upsert pattern — one document of each doc_type per case.
 * If an existing record for the same case + doc_type exists, it is
 * updated in place; otherwise a new row is inserted.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SaveDocumentInput {
  caseId: string;
  studentId: string;
  schoolId: string;
  docType: string;
  title: string;
  contentJson: Record<string, unknown>;
  sentMethod?: string;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

/**
 * Upsert a compliance document record.
 * Returns the document ID (existing or newly created).
 */
export async function saveDocument(input: SaveDocumentInput): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    // Check for an existing document of the same type for this case
    const { data: existingDoc } = await supabase
      .from("compliance_documents")
      .select("id")
      .eq("case_id", input.caseId)
      .eq("doc_type", input.docType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDoc) {
      await supabase
        .from("compliance_documents")
        .update({
          title: input.title,
          content_json: input.contentJson,
          generated_at: now,
          generated_by: user?.id ?? null,
          ...(input.sentMethod != null ? { sent_method: input.sentMethod } : {}),
        })
        .eq("id", existingDoc.id);
      return existingDoc.id;
    }

    // Insert new record
    const { data: newDoc, error: insertError } = await supabase
      .from("compliance_documents")
      .insert({
        case_id: input.caseId,
        student_id: input.studentId,
        school_id: input.schoolId,
        doc_type: input.docType,
        title: input.title,
        content_json: input.contentJson,
        generated_by: user?.id ?? null,
        ...(input.sentMethod != null ? { sent_method: input.sentMethod } : {}),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return newDoc.id;
  } catch (err) {
    throw handleServiceError("save document", err);
  }
}
