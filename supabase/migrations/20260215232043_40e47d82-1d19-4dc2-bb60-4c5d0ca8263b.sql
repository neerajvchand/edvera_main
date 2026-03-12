
-- Table to track district board-listing URLs for scraping
CREATE TABLE public.district_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'board_listing',
  url text NOT NULL,
  label text,
  last_checked_at timestamptz,
  last_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one source per type per district
ALTER TABLE public.district_sources
  ADD CONSTRAINT district_sources_district_type_unique UNIQUE (district_id, source_type, url);

-- Enable RLS
ALTER TABLE public.district_sources ENABLE ROW LEVEL SECURITY;

-- Public read (admin tooling reads these)
CREATE POLICY "Authenticated users can read district_sources"
  ON public.district_sources FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage sources
CREATE POLICY "District admins can insert district_sources"
  ON public.district_sources FOR INSERT TO authenticated
  WITH CHECK (public.has_membership_role(auth.uid(), 'admin', NULL, district_id));

CREATE POLICY "District admins can update district_sources"
  ON public.district_sources FOR UPDATE TO authenticated
  USING (public.has_membership_role(auth.uid(), 'admin', NULL, district_id));

-- Trigger for updated_at
CREATE TRIGGER update_district_sources_updated_at
  BEFORE UPDATE ON public.district_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_net for cron HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
