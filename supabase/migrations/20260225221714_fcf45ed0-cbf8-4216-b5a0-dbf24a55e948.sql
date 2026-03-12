
CREATE POLICY "Staff can view children at their school"
  ON public.children
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_staff(auth.uid(), school_id::uuid)
  );

CREATE POLICY "Staff can view parent profiles at their school"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.parent_id = profiles.user_id
        AND public.is_active_staff(auth.uid(), c.school_id::uuid)
    )
  );
