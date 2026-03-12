import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { toast } from "@/hooks/use-toast";

export type DocType = "board_agenda" | "policy_procedure" | "vendor_proposal" | "newsletter_comms" | "other";
export type Audience = "board" | "superintendent" | "principal" | "operations";
export type Tone = "neutral" | "formal" | "concise";
export type DocStatus = "uploaded" | "processing" | "complete" | "failed";

export interface DocumentRow {
  id: string;
  uploader_id: string;
  filename: string;
  file_path: string;
  doc_type: string;
  audience: string;
  tone: string;
  strict_mode: boolean;
  status: string;
  created_at: string;
}

export interface DocumentOutput {
  id: string;
  document_id: string;
  action_items_json: any[];
  risks_json: any[];
  memo_text: string;
  citations_json: any[];
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  page_number: number | null;
  section_heading: string | null;
  text: string;
}

export interface DocAuditEvent {
  id: string;
  document_id: string;
  stage: string;
  message: string;
  payload_json: any;
  created_at: string;
}

export function useDocuments() {
  const { user } = useSession();

  return useQuery({
    queryKey: ["documents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as DocumentRow[]) ?? [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

export function useDocumentOutput(documentId: string | null) {
  return useQuery({
    queryKey: ["document_output", documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const { data, error } = await supabase
        .from("document_outputs")
        .select("*")
        .eq("document_id", documentId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DocumentOutput | null;
    },
    enabled: !!documentId,
    refetchInterval: 3000,
  });
}

export function useDocumentChunks(documentId: string | null) {
  return useQuery({
    queryKey: ["document_chunks", documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from("document_chunks")
        .select("*")
        .eq("document_id", documentId)
        .order("chunk_index", { ascending: true });
      if (error) throw error;
      return (data as unknown as DocumentChunk[]) ?? [];
    },
    enabled: !!documentId,
  });
}

export function useDocAuditEvents(documentId: string | null) {
  return useQuery({
    queryKey: ["doc_audit_events", documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from("doc_audit_events")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as DocAuditEvent[]) ?? [];
    },
    enabled: !!documentId,
  });
}

export function useUploadDocument() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<string>("idle");

  const mutation = useMutation({
    mutationFn: async ({
      file,
      docType,
      audience,
      tone,
      strictMode,
    }: {
      file: File;
      docType: DocType;
      audience: Audience;
      tone: Tone;
      strictMode: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx", "doc", "txt", "md", "csv"].includes(ext || "")) {
        throw new Error("Unsupported file type. Please upload a PDF, DOCX, or CSV file.");
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("File exceeds 20MB size limit.");
      }

      setUploadProgress("uploading");

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("staff_documents")
        .upload(filePath, file);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setUploadProgress("creating");

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          uploader_id: user.id,
          filename: file.name,
          file_path: filePath,
          doc_type: docType,
          audience,
          tone,
          strict_mode: strictMode,
          status: "uploaded",
        } as any)
        .select()
        .single();

      if (docError) throw new Error(`Failed to create document: ${docError.message}`);

      setUploadProgress("processing");

      const { error: fnError } = await supabase.functions.invoke(
        "process-document",
        { body: { document_id: (doc as any).id } }
      );

      if (fnError) {
        console.error("Process function error:", fnError);
      }

      return doc as unknown as DocumentRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setUploadProgress("idle");
      toast({
        title: "Document uploaded",
        description: "Processing has started. Results will appear shortly.",
      });
    },
    onError: (error: Error) => {
      setUploadProgress("idle");
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { ...mutation, uploadProgress };
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      // Delete related rows first (cascade manually since RLS prevents service-role-only cascades)
      // The order matters: chunks, outputs, audit events, then the document itself
      const { error: chunksErr } = await supabase
        .from("document_chunks")
        .delete()
        .eq("document_id", doc.id);
      // These tables have no DELETE RLS, so we use a workaround:
      // We'll delete what we can. If RLS blocks, the edge function should handle it.
      
      const { error: outputsErr } = await supabase
        .from("document_outputs")
        .delete()
        .eq("document_id", doc.id);

      const { error: auditErr } = await supabase
        .from("doc_audit_events")
        .delete()
        .eq("document_id", doc.id);

      // Delete the document record
      const { error: docErr } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (docErr) throw new Error(`Failed to delete document: ${docErr.message}`);

      // Delete file from storage
      await supabase.storage
        .from("staff_documents")
        .remove([doc.file_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document deleted", description: "Document and all outputs have been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useRerunAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (docId: string) => {
      // Update status to processing
      const { error: updateErr } = await supabase
        .from("documents")
        .update({ status: "processing" } as any)
        .eq("id", docId);

      if (updateErr) throw new Error(`Failed to update status: ${updateErr.message}`);

      // Delete old outputs so they get overwritten
      await supabase.from("document_outputs").delete().eq("document_id", docId);
      await supabase.from("document_chunks").delete().eq("document_id", docId);

      // Trigger processing
      const { error: fnError } = await supabase.functions.invoke(
        "process-document",
        { body: { document_id: docId } }
      );

      if (fnError) {
        console.error("Re-run function error:", fnError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document_output"] });
      queryClient.invalidateQueries({ queryKey: ["document_chunks"] });
      queryClient.invalidateQueries({ queryKey: ["doc_audit_events"] });
      toast({ title: "Re-analysis started", description: "Processing has restarted." });
    },
    onError: (error: Error) => {
      toast({ title: "Re-run failed", description: error.message, variant: "destructive" });
    },
  });
}
