CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  district_id UUID,
  tool_name TEXT NOT NULL,
  inputs_summary JSONB,
  output_summary TEXT,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: district admins can read their own district logs
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_read_agent_logs" ON agent_logs
  FOR SELECT USING (
    district_id IN (
      SELECT d.id FROM districts d
      JOIN schools s ON s.district_id = d.id
      JOIN profiles p ON p.user_id = auth.uid()
      WHERE p.role IN ('district_admin', 'principal')
    )
  );
