
-- Fix get_today_at_a_glance to use school timezone for current date
CREATE OR REPLACE FUNCTION public.get_today_at_a_glance(p_school_id uuid, p_date date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_override record;
  v_schedule_id uuid;
  v_first_start time;
  v_last_end time;
  v_tz text;
  v_date date;
BEGIN
  -- Get school timezone
  SELECT s.timezone INTO v_tz FROM schools s WHERE s.id = p_school_id;
  v_tz := COALESCE(v_tz, 'America/Los_Angeles');

  -- Use school-local date if not explicitly provided
  v_date := COALESCE(p_date, (now() AT TIME ZONE v_tz)::date);

  -- Weekend check
  IF EXTRACT(DOW FROM v_date) IN (0, 6) THEN
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
  WHERE d.school_id = p_school_id AND d.date = v_date;

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
    AND (bs.effective_start IS NULL OR bs.effective_start <= v_date)
    AND (bs.effective_end IS NULL OR bs.effective_end >= v_date)
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
$function$;

-- Fix get_todays_schedule to also use school timezone
CREATE OR REPLACE FUNCTION public.get_todays_schedule(p_school_id uuid, p_date date DEFAULT NULL)
 RETURNS TABLE(label text, start_local time without time zone, end_local time without time zone, sort_order integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule_id uuid;
  v_day_type text;
  v_tz text;
  v_date date;
BEGIN
  -- Get school timezone
  SELECT s.timezone INTO v_tz FROM schools s WHERE s.id = p_school_id;
  v_tz := COALESCE(v_tz, 'America/Los_Angeles');

  -- Use school-local date if not explicitly provided
  v_date := COALESCE(p_date, (now() AT TIME ZONE v_tz)::date);

  -- Check for day override to pick schedule name
  SELECT d.day_type INTO v_day_type
  FROM day_overrides d
  WHERE d.school_id = p_school_id AND d.date = v_date;

  -- Weekend check
  IF EXTRACT(DOW FROM v_date) IN (0, 6) THEN
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
      AND (bs.effective_start IS NULL OR bs.effective_start <= v_date)
      AND (bs.effective_end IS NULL OR bs.effective_end >= v_date)
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
$function$;
