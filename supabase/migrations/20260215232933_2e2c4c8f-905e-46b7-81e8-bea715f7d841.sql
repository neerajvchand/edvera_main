
ALTER TABLE public.board_meetings
  ADD COLUMN relevance_score numeric NOT NULL DEFAULT 0.3,
  ADD COLUMN impact_summary text,
  ADD COLUMN affects_students boolean NOT NULL DEFAULT false,
  ADD COLUMN affects_safety boolean NOT NULL DEFAULT false,
  ADD COLUMN affects_schedule boolean NOT NULL DEFAULT false,
  ADD COLUMN affects_policy boolean NOT NULL DEFAULT false;
