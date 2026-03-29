
ALTER TABLE public.board_meetings
  ADD COLUMN external_id text,
  ADD COLUMN status text NOT NULL DEFAULT 'brief_pending',
  ADD COLUMN detected_at timestamptz DEFAULT now();

ALTER TABLE public.board_meetings
  ADD CONSTRAINT board_meetings_district_external_unique UNIQUE (district_id, external_id);
