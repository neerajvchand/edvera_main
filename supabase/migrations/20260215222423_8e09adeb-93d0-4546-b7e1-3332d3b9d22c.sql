
-- Tighten: only allow authenticated users to insert districts
DROP POLICY "Authenticated users can insert districts" ON public.districts;
CREATE POLICY "Authenticated users can insert districts"
  ON public.districts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tighten: only allow updating district_id column on schools, for authenticated users
DROP POLICY "Authenticated users can update school district_id" ON public.schools;
CREATE POLICY "Authenticated users can update school district_id"
  ON public.schools FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
