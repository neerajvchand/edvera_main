-- Step A3: Add NOT NULL check constraint safely (no backfill needed — 0 NULL rows)
ALTER TABLE public.school_events
  ADD CONSTRAINT school_events_source_event_id_not_null
  CHECK (source_event_id IS NOT NULL) NOT VALID;

ALTER TABLE public.school_events
  VALIDATE CONSTRAINT school_events_source_event_id_not_null;