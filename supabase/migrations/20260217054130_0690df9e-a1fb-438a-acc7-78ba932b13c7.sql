-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a log table for ingestion runs
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'calendar',
  started_at timestamptz NOT NULL DEFAULT now(),
  schools_attempted int NOT NULL DEFAULT 0,
  schools_succeeded int NOT NULL DEFAULT 0,
  schools_failed int NOT NULL DEFAULT 0,
  last_error text,
  completed_at timestamptz
);

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Only service role / admin can write; authenticated users can read for diagnostics
CREATE POLICY "Authenticated users can read ingestion_runs"
  ON public.ingestion_runs FOR SELECT
  USING (true);