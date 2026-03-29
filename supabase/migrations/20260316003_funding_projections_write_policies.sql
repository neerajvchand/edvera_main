-- Allow service-role and authenticated staff to manage funding_projections.
-- The compute-funding engine uses service_role which bypasses RLS,
-- but these policies support any future admin-panel or manual operations.

-- INSERT policy: staff can insert funding projections for their schools
DROP POLICY IF EXISTS "staff_can_insert_funding_projections" ON public.funding_projections;
CREATE POLICY "staff_can_insert_funding_projections"
  ON public.funding_projections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.staff_memberships
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- UPDATE policy: staff can update funding projections for their schools
DROP POLICY IF EXISTS "staff_can_update_funding_projections" ON public.funding_projections;
CREATE POLICY "staff_can_update_funding_projections"
  ON public.funding_projections
  FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM public.staff_memberships
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- DELETE policy: staff can delete funding projections for their schools
DROP POLICY IF EXISTS "staff_can_delete_funding_projections" ON public.funding_projections;
CREATE POLICY "staff_can_delete_funding_projections"
  ON public.funding_projections
  FOR DELETE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM public.staff_memberships
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );
