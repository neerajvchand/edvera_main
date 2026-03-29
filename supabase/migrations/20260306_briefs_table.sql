-- =============================================
-- Briefs table — stores generated daily briefs per school
-- API-first: any delivery channel (email, Slack, portal)
-- can read from this table
-- =============================================

CREATE TABLE public.briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id),
  district_id uuid,
  brief_date date NOT NULL DEFAULT CURRENT_DATE,
  narrative text NOT NULL,
  metrics_snapshot jsonb NOT NULL,
  students_flagged jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  run_id uuid REFERENCES public.agent_runs(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_sees_own_school_briefs" ON public.briefs
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM public.staff_memberships WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_briefs_school_date ON public.briefs(school_id, brief_date DESC);
