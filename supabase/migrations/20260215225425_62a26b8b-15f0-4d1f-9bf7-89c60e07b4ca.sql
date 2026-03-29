
-- Allow district admins to INSERT board_meetings
CREATE POLICY "District admins can insert board meetings"
ON public.board_meetings
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_membership_role(auth.uid(), 'admin', NULL, district_id)
);

-- Allow district admins to UPDATE board_meetings
CREATE POLICY "District admins can update board meetings"
ON public.board_meetings
FOR UPDATE
TO authenticated
USING (
  public.has_membership_role(auth.uid(), 'admin', NULL, district_id)
)
WITH CHECK (
  public.has_membership_role(auth.uid(), 'admin', NULL, district_id)
);
