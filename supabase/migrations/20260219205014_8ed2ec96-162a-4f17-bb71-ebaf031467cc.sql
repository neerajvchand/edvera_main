
-- Allow document owners to delete their own document_chunks
CREATE POLICY "Uploaders can delete own chunks"
ON public.document_chunks
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM documents d
  WHERE d.id = document_chunks.document_id AND d.uploader_id = auth.uid()
));

-- Allow document owners to delete their own document_outputs
CREATE POLICY "Uploaders can delete own outputs"
ON public.document_outputs
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM documents d
  WHERE d.id = document_outputs.document_id AND d.uploader_id = auth.uid()
));

-- Allow document owners to delete their own doc_audit_events
CREATE POLICY "Uploaders can delete own audit events"
ON public.doc_audit_events
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM documents d
  WHERE d.id = doc_audit_events.document_id AND d.uploader_id = auth.uid()
));

-- Allow document owners to delete their own documents
CREATE POLICY "Uploaders can delete own documents"
ON public.documents
FOR DELETE
USING (auth.uid() = uploader_id);
