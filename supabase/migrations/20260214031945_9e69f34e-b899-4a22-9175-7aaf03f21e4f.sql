
-- Add school authorization helper function
CREATE OR REPLACE FUNCTION public.user_has_school_access(p_user_id uuid, p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM children
    WHERE parent_id = p_user_id
    AND school_id::uuid = p_school_id
  );
$$;

-- Recreate get_today_at_a_glance with authorization check
CREATE OR REPLACE FUNCTION public.get_today_at_a_glance(p_school_id uuid, p_date date DEFAULT NULL::date)
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
  -- Authorization: verify user has access to this school
  IF NOT public.user_has_school_access(auth.uid(), p_school_id) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  SELECT s.timezone INTO v_tz FROM schools s WHERE s.id = p_school_id;
  v_tz := COALESCE(v_tz, 'America/Los_Angeles');
  v_date := COALESCE(p_date, (now() AT TIME ZONE v_tz)::date);

  IF EXTRACT(DOW FROM v_date) IN (0, 6) THEN
    RETURN jsonb_build_object(
      'day_type', 'Weekend',
      'start_time', null,
      'pickup_time', null,
      'notes', null,
      'schedule_name', 'Weekend'
    );
  END IF;

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

-- Recreate get_coming_up with authorization check
CREATE OR REPLACE FUNCTION public.get_coming_up(p_school_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, title text, description text, location text, start_time timestamp with time zone, end_time timestamp with time zone, all_day boolean, category text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT se.id, se.title, se.description, se.location, se.start_time, se.end_time, se.all_day, se.category
  FROM school_events se
  WHERE se.school_id = p_school_id
    AND se.start_time > now()
    AND public.user_has_school_access(auth.uid(), p_school_id)
  ORDER BY se.start_time ASC
  LIMIT p_limit;
$function$;

-- Recreate get_todays_schedule with authorization check
CREATE OR REPLACE FUNCTION public.get_todays_schedule(p_school_id uuid, p_date date DEFAULT NULL::date)
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
  -- Authorization: verify user has access to this school
  IF NOT public.user_has_school_access(auth.uid(), p_school_id) THEN
    RETURN;
  END IF;

  SELECT s.timezone INTO v_tz FROM schools s WHERE s.id = p_school_id;
  v_tz := COALESCE(v_tz, 'America/Los_Angeles');
  v_date := COALESCE(p_date, (now() AT TIME ZONE v_tz)::date);

  SELECT d.day_type INTO v_day_type
  FROM day_overrides d
  WHERE d.school_id = p_school_id AND d.date = v_date;

  IF EXTRACT(DOW FROM v_date) IN (0, 6) THEN
    RETURN;
  END IF;

  IF v_day_type IS NOT NULL THEN
    SELECT bs.id INTO v_schedule_id
    FROM bell_schedules bs
    WHERE bs.school_id = p_school_id AND bs.schedule_name = v_day_type
    LIMIT 1;
  END IF;

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

-- Recreate get_current_insight_for_school: use auth.uid() instead of accepting p_user_id
CREATE OR REPLACE FUNCTION public.get_current_insight_for_school(p_school_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS TABLE(insight_id uuid, insight_key text, category text, severity text, headline text, context text, why_this text, source text, last_updated date, mini_viz_type text, payload jsonb, priority_score integer, school_insight_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Always use auth.uid(), ignore p_user_id parameter
  v_user_id := auth.uid();

  -- Authorization: verify user has access to this school
  IF NOT public.user_has_school_access(v_user_id, p_school_id) THEN
    RETURN;
  END IF;

  -- Try to return highest-priority insight NOT seen by this user in the last 7 days
  RETURN QUERY
  SELECT
    i.id AS insight_id,
    i.insight_key,
    i.category,
    i.severity,
    i.headline,
    i.context,
    i.why_this,
    i.source,
    i.last_updated,
    i.mini_viz_type,
    i.payload,
    si.priority_score,
    si.id AS school_insight_id
  FROM public.school_insights si
  JOIN public.insights i ON i.id = si.insight_id
  WHERE si.school_id = p_school_id
    AND i.is_active = true
    AND si.start_date <= CURRENT_DATE
    AND (si.end_date IS NULL OR si.end_date >= CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM public.insight_impressions imp
      WHERE imp.user_id = v_user_id
        AND imp.insight_id = i.id
        AND imp.school_id = p_school_id
        AND imp.seen_at > now() - interval '7 days'
    )
  ORDER BY si.priority_score DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      i.id AS insight_id,
      i.insight_key,
      i.category,
      i.severity,
      i.headline,
      i.context,
      i.why_this,
      i.source,
      i.last_updated,
      i.mini_viz_type,
      i.payload,
      si.priority_score,
      si.id AS school_insight_id
    FROM public.school_insights si
    JOIN public.insights i ON i.id = si.insight_id
    WHERE si.school_id = p_school_id
      AND i.is_active = true
      AND si.start_date <= CURRENT_DATE
      AND (si.end_date IS NULL OR si.end_date >= CURRENT_DATE)
    ORDER BY si.priority_score DESC
    LIMIT 1;
  END IF;
END;
$function$;
