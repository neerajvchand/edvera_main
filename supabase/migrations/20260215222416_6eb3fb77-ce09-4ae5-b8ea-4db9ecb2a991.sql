
-- Add district_id to children table
ALTER TABLE public.children
  ADD COLUMN district_id uuid REFERENCES public.districts(id);

CREATE INDEX idx_children_district_id ON public.children(district_id);

-- Allow authenticated users to insert districts (for on-the-fly creation)
CREATE POLICY "Authenticated users can insert districts"
  ON public.districts FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to update schools.district_id
-- (needed to link school to newly created district)
CREATE POLICY "Authenticated users can update school district_id"
  ON public.schools FOR UPDATE
  USING (true)
  WITH CHECK (true);
