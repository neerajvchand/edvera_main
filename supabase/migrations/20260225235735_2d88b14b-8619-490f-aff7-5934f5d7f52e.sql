CREATE POLICY "Staff can view attendance entries at their school"
  ON public.attendance_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = attendance_entries.child_id
        AND public.is_active_staff(auth.uid(), c.school_id::uuid)
    )
  );