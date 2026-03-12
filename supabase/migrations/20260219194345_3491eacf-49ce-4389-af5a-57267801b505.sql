
-- Documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL,
  filename text NOT NULL,
  file_path text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  audience text NOT NULL DEFAULT 'principal',
  tone text NOT NULL DEFAULT 'neutral',
  strict_mode boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Staff who uploaded can read their own docs
CREATE POLICY "Uploaders can read own documents"
ON public.documents FOR SELECT
USING (auth.uid() = uploader_id);

-- Staff can insert their own documents
CREATE POLICY "Staff can insert own documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = uploader_id);

-- Staff can update own documents (status changes)
CREATE POLICY "Staff can update own documents"
ON public.documents FOR UPDATE
USING (auth.uid() = uploader_id);

-- Document chunks
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_number integer,
  section_heading text,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chunk owners can read"
ON public.document_chunks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.documents d
  WHERE d.id = document_chunks.document_id
    AND d.uploader_id = auth.uid()
));

-- Document outputs
CREATE TABLE public.document_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  action_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  memo_text text NOT NULL DEFAULT '',
  citations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Output owners can read"
ON public.document_outputs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.documents d
  WHERE d.id = document_outputs.document_id
    AND d.uploader_id = auth.uid()
));

-- Audit events for pipeline stages
CREATE TABLE public.doc_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  stage text NOT NULL,
  message text NOT NULL DEFAULT '',
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doc_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit event owners can read"
ON public.doc_audit_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.documents d
  WHERE d.id = doc_audit_events.document_id
    AND d.uploader_id = auth.uid()
));

-- Storage bucket for staff documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff_documents', 'staff_documents', false);

-- Storage policies: only authenticated staff can upload to their own folder
CREATE POLICY "Staff can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'staff_documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can read own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'staff_documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'staff_documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
