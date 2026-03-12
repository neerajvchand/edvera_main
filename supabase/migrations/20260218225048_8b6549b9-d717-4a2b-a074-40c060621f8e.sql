-- Allow parents to read triage entries for their own children
CREATE POLICY "Parents can read own children triage"
ON public.attendance_triage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = attendance_triage.child_id
      AND c.parent_id = auth.uid()
  )
);