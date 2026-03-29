
-- Function to escalate published board meetings to action_items
CREATE OR REPLACE FUNCTION public.escalate_board_meeting_to_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag text;
  v_severity numeric;
  v_description text;
BEGIN
  -- Only fire when status is 'published'
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  -- Check escalation criteria
  IF NOT (
    NEW.relevance_score >= 0.8
    OR NEW.affects_safety = true
    OR NEW.affects_schedule = true
  ) THEN
    RETURN NEW;
  END IF;

  v_tag := 'board_meeting:' || NEW.id::text;
  v_severity := LEAST(1, GREATEST(0, COALESCE(NEW.relevance_score, 0.3)));
  v_description := COALESCE(NEW.impact_summary, '') || E'\n\n' || COALESCE(NEW.summary_short, '');

  -- Insert for each active parent in the district, skipping duplicates
  INSERT INTO public.action_items (
    user_id, category, title, description, severity,
    requires_action, source_kind, source_label, source_confidence,
    source_url, status, tags
  )
  SELECT
    m.user_id,
    'alert',
    'Board Update: ' || NEW.title,
    v_description,
    v_severity,
    false,
    'district',
    'Board Brief',
    0.9,
    NEW.source_url,
    'open',
    ARRAY[v_tag]
  FROM public.memberships m
  WHERE m.district_id = NEW.district_id
    AND m.role = 'parent'
    AND m.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.action_items ai
      WHERE ai.user_id = m.user_id
        AND v_tag = ANY(ai.tags)
    );

  RETURN NEW;
END;
$$;

-- Trigger on insert or update of board_meetings
CREATE TRIGGER trg_escalate_board_meeting
  AFTER INSERT OR UPDATE ON public.board_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.escalate_board_meeting_to_actions();
