
-- Drop previous tables
DROP TABLE IF EXISTS public.insight_views CASCADE;
DROP TABLE IF EXISTS public.insights CASCADE;

-- 1) schools
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cds_code TEXT UNIQUE,
  name TEXT NOT NULL,
  district_name TEXT,
  county_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) insights (template/catalog)
CREATE TABLE public.insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('Attendance', 'Engagement', 'Academics', 'Wellbeing', 'Safety')),
  severity TEXT NOT NULL DEFAULT 'neutral' CHECK (severity IN ('good', 'neutral', 'concern')),
  headline TEXT NOT NULL,
  context TEXT NOT NULL,
  why_this TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'CDE',
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  mini_viz_type TEXT NOT NULL DEFAULT 'bullet' CHECK (mini_viz_type IN ('bullet', 'sparkline', 'gauge')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) school_insights (link table)
CREATE TABLE public.school_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  insight_id UUID NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
  priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score BETWEEN 0 AND 100),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, insight_id)
);

-- 4) insight_impressions (fatigue control)
CREATE TABLE public.insight_impressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  insight_id UUID NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_impressions ENABLE ROW LEVEL SECURITY;

-- RLS: schools readable by authenticated users
CREATE POLICY "Authenticated users can read schools"
  ON public.schools FOR SELECT TO authenticated USING (true);

-- RLS: insights readable by authenticated users (only active ones shown via queries)
CREATE POLICY "Authenticated users can read insights"
  ON public.insights FOR SELECT TO authenticated USING (true);

-- RLS: school_insights readable by authenticated users
CREATE POLICY "Authenticated users can read school_insights"
  ON public.school_insights FOR SELECT TO authenticated USING (true);

-- RLS: insight_impressions - users can only read their own
CREATE POLICY "Users can view own impressions"
  ON public.insight_impressions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: insight_impressions - users can insert for themselves only
CREATE POLICY "Users can insert own impressions"
  ON public.insight_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_school_insights_school ON public.school_insights(school_id, priority_score DESC);
CREATE INDEX idx_insight_impressions_user_school ON public.insight_impressions(user_id, school_id, seen_at DESC);
CREATE INDEX idx_insights_active ON public.insights(is_active) WHERE is_active = true;

-- Function: get_current_insight_for_school
CREATE OR REPLACE FUNCTION public.get_current_insight_for_school(p_school_id UUID, p_user_id UUID)
RETURNS TABLE (
  insight_id UUID,
  insight_key TEXT,
  category TEXT,
  severity TEXT,
  headline TEXT,
  context TEXT,
  why_this TEXT,
  source TEXT,
  last_updated DATE,
  mini_viz_type TEXT,
  payload JSONB,
  priority_score INTEGER,
  school_insight_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
      WHERE imp.user_id = p_user_id
        AND imp.insight_id = i.id
        AND imp.school_id = p_school_id
        AND imp.seen_at > now() - interval '7 days'
    )
  ORDER BY si.priority_score DESC
  LIMIT 1;

  -- If nothing returned (all seen recently), fall back to highest priority regardless
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
$$;
