
-- Add columns to existing schools table
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles',
ADD COLUMN IF NOT EXISTS calendar_feed_url text,
ADD COLUMN IF NOT EXISTS calendar_page_url text,
ADD COLUMN IF NOT EXISTS bell_schedule_url text;

-- school_events
CREATE TABLE public.school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_event_id text,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  category text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_school_events_source_unique 
ON public.school_events (school_id, source_event_id) 
WHERE source_event_id IS NOT NULL;

CREATE INDEX idx_school_events_school_start 
ON public.school_events (school_id, start_time);

ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read school events"
ON public.school_events FOR SELECT
TO authenticated
USING (true);

-- bell_schedules
CREATE TABLE public.bell_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  schedule_name text NOT NULL,
  effective_start date,
  effective_end date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bell_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bell schedules"
ON public.bell_schedules FOR SELECT
TO authenticated
USING (true);

-- bell_blocks
CREATE TABLE public.bell_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bell_schedule_id uuid NOT NULL REFERENCES public.bell_schedules(id) ON DELETE CASCADE,
  label text NOT NULL,
  start_local time NOT NULL,
  end_local time NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bell_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bell blocks"
ON public.bell_blocks FOR SELECT
TO authenticated
USING (true);

-- day_overrides
CREATE TABLE public.day_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_type text NOT NULL,
  pickup_time_local time,
  start_time_local time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, date)
);

ALTER TABLE public.day_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read day overrides"
ON public.day_overrides FOR SELECT
TO authenticated
USING (true);

-- RPC: get_today_at_a_glance
CREATE OR REPLACE FUNCTION public.get_today_at_a_glance(p_school_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override record;
  v_schedule_id uuid;
  v_first_start time;
  v_last_end time;
BEGIN
  -- Weekend check
  IF EXTRACT(DOW FROM p_date) IN (0, 6) THEN
    RETURN jsonb_build_object(
      'day_type', 'Weekend',
      'start_time', null,
      'pickup_time', null,
      'notes', null,
      'schedule_name', 'Weekend'
    );
  END IF;

  -- Check day_overrides first
  SELECT d.day_type, d.start_time_local, d.pickup_time_local, d.notes
  INTO v_override
  FROM day_overrides d
  WHERE d.school_id = p_school_id AND d.date = p_date;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'day_type', v_override.day_type,
      'start_time', v_override.start_time_local,
      'pickup_time', v_override.pickup_time_local,
      'notes', v_override.notes,
      'schedule_name', v_override.day_type
    );
  END IF;

  -- Default: find Regular schedule, derive times from bell blocks
  SELECT bs.id INTO v_schedule_id
  FROM bell_schedules bs
  WHERE bs.school_id = p_school_id
    AND bs.schedule_name = 'Regular'
    AND (bs.effective_start IS NULL OR bs.effective_start <= p_date)
    AND (bs.effective_end IS NULL OR bs.effective_end >= p_date)
  LIMIT 1;

  IF v_schedule_id IS NULL THEN
    RETURN jsonb_build_object(
      'day_type', 'Normal Day',
      'start_time', null,
      'pickup_time', null,
      'notes', 'No schedule data available',
      'schedule_name', null
    );
  END IF;

  SELECT bb.start_local INTO v_first_start
  FROM bell_blocks bb WHERE bb.bell_schedule_id = v_schedule_id
  ORDER BY bb.sort_order ASC LIMIT 1;

  SELECT bb.end_local INTO v_last_end
  FROM bell_blocks bb WHERE bb.bell_schedule_id = v_schedule_id
  ORDER BY bb.sort_order DESC LIMIT 1;

  RETURN jsonb_build_object(
    'day_type', 'Normal Day',
    'start_time', v_first_start,
    'pickup_time', v_last_end,
    'notes', null,
    'schedule_name', 'Regular'
  );
END;
$$;

-- RPC: get_coming_up
CREATE OR REPLACE FUNCTION public.get_coming_up(p_school_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean,
  category text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT se.id, se.title, se.description, se.location, se.start_time, se.end_time, se.all_day, se.category
  FROM school_events se
  WHERE se.school_id = p_school_id
    AND se.start_time > now()
  ORDER BY se.start_time ASC
  LIMIT p_limit;
$$;

-- RPC: get_todays_schedule
CREATE OR REPLACE FUNCTION public.get_todays_schedule(p_school_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(label text, start_local time, end_local time, sort_order integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id uuid;
  v_day_type text;
BEGIN
  -- Check for day override to pick schedule name
  SELECT d.day_type INTO v_day_type
  FROM day_overrides d
  WHERE d.school_id = p_school_id AND d.date = p_date;

  -- Weekend check
  IF EXTRACT(DOW FROM p_date) IN (0, 6) THEN
    RETURN;
  END IF;

  -- Find matching schedule
  IF v_day_type IS NOT NULL THEN
    SELECT bs.id INTO v_schedule_id
    FROM bell_schedules bs
    WHERE bs.school_id = p_school_id AND bs.schedule_name = v_day_type
    LIMIT 1;
  END IF;

  -- Fallback to Regular
  IF v_schedule_id IS NULL THEN
    SELECT bs.id INTO v_schedule_id
    FROM bell_schedules bs
    WHERE bs.school_id = p_school_id
      AND bs.schedule_name = 'Regular'
      AND (bs.effective_start IS NULL OR bs.effective_start <= p_date)
      AND (bs.effective_end IS NULL OR bs.effective_end >= p_date)
    LIMIT 1;
  END IF;

  IF v_schedule_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT bb.label, bb.start_local, bb.end_local, bb.sort_order
  FROM bell_blocks bb
  WHERE bb.bell_schedule_id = v_schedule_id
  ORDER BY bb.sort_order;
END;
$$;
