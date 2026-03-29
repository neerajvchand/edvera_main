-- Fix: Add write-access RLS policies on compliance_cases and intervention_log.
-- Both tables had only a FOR SELECT policy, which silently blocked
-- client-side updates such as tier_requirements writeback.

-- compliance_cases: allow staff to update/insert rows for their school
CREATE POLICY "Staff can update compliance_cases"
  ON public.compliance_cases FOR UPDATE
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can insert compliance_cases"
  ON public.compliance_cases FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));

-- intervention_log: allow staff to insert/update rows for their school
CREATE POLICY "Staff can update intervention_log"
  ON public.intervention_log FOR UPDATE
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can insert intervention_log"
  ON public.intervention_log FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));
