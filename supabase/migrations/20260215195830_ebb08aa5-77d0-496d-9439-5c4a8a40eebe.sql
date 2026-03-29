
ALTER TABLE public.legal_pages
  ADD COLUMN version text NOT NULL DEFAULT '1.0',
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN summary text;

ALTER TABLE public.legal_pages
  ADD CONSTRAINT legal_pages_slug_unique UNIQUE (slug);
