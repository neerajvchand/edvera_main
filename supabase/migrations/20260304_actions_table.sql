-- =============================================
-- Actions table — generated tasks from compliance and risk engines
-- =============================================

CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  compliance_case_id uuid REFERENCES public.compliance_cases(id) ON DELETE SET NULL,

  action_type text NOT NULL,  -- 'send_letter', 'schedule_conference', 'prepare_sarb_packet', 'follow_up_call', 'review_case'
  title text NOT NULL,
  description text,
  reason text,  -- legal citation or engine reason

  priority text NOT NULL DEFAULT 'normal',  -- 'urgent', 'high', 'normal'
  status text NOT NULL DEFAULT 'open',  -- 'open', 'completed', 'deferred', 'cancelled'

  assigned_to uuid REFERENCES auth.users(id),
  due_date date NOT NULL,

  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  completion_notes text,
  completion_outcome text,  -- 'completed', 'completed_no_response', 'unable_to_complete', 'deferred'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_actions_school_status ON public.actions(school_id, status);
CREATE INDEX idx_actions_assigned ON public.actions(assigned_to, status);
CREATE INDEX idx_actions_due_date ON public.actions(due_date) WHERE status = 'open';
CREATE INDEX idx_actions_student ON public.actions(student_id);
CREATE INDEX idx_actions_case ON public.actions(compliance_case_id, action_type);

-- RLS
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view and manage actions for their schools"
  ON public.actions FOR ALL
  USING (public.is_active_staff(auth.uid(), school_id));

-- Updated_at trigger (same pattern as other tables)
CREATE TRIGGER update_actions_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
