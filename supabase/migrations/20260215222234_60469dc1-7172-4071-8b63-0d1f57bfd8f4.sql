
-- 1) Create districts table
CREATE TABLE public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text DEFAULT 'CA',
  website_url text,
  board_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- Public read access for authenticated users
CREATE POLICY "Authenticated users can read districts"
  ON public.districts FOR SELECT
  USING (true);

-- Timestamp trigger
CREATE TRIGGER update_districts_updated_at
  BEFORE UPDATE ON public.districts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add district_id to schools
ALTER TABLE public.schools
  ADD COLUMN district_id uuid REFERENCES public.districts(id);

-- 3) Indexes
CREATE INDEX idx_schools_district_id ON public.schools(district_id);
CREATE INDEX idx_districts_name ON public.districts(name);
