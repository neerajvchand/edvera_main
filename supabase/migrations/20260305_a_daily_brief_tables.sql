-- =============================================
-- Daily Brief Agent tables
-- agent_runs: logs each brief generation run
-- =============================================

-- 1. agent_runs
CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'daily_brief',
  district_id uuid REFERENCES public.districts(id),
  schools_processed integer DEFAULT 0,
  briefs_sent integer DEFAULT 0,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_runs_status
  ON public.agent_runs(status, started_at DESC);
CREATE INDEX idx_agent_runs_district
  ON public.agent_runs(district_id, started_at DESC);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "District staff can read agent_runs"
  ON public.agent_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schools s
      JOIN public.staff_memberships sm ON sm.school_id = s.id
      WHERE s.district_id = agent_runs.district_id
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
    )
  );
