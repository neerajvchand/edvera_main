
-- Insights table: stores curated insight records per school
CREATE TABLE public.insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('attendance', 'academics', 'wellbeing', 'engagement', 'safety')),
  severity TEXT NOT NULL DEFAULT 'neutral' CHECK (severity IN ('good', 'neutral', 'concern')),
  headline TEXT NOT NULL,
  context_line TEXT NOT NULL,
  cta_label TEXT NOT NULL DEFAULT 'See details',
  why_shown TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'California Dashboard',
  
  -- Detail view content (JSONB for flexibility)
  what_it_means JSONB NOT NULL DEFAULT '[]'::jsonb,        -- array of strings (bullets)
  metric_value NUMERIC,                                      -- e.g. 18.5 (percent)
  metric_label TEXT,                                          -- e.g. "Chronic Absence Rate"
  comparison_value NUMERIC,                                   -- e.g. 14.2 (median)
  comparison_label TEXT,                                      -- e.g. "Similar Schools Median"
  trend_data JSONB DEFAULT '[]'::jsonb,                       -- [{year, value}]
  compare_data JSONB DEFAULT '{}'::jsonb,                     -- {similar, district, county, bayArea}
  what_you_can_do JSONB NOT NULL DEFAULT '[]'::jsonb,        -- array of strings (tips)
  questions_to_ask JSONB NOT NULL DEFAULT '[]'::jsonb,       -- array of strings (suggested prompts)
  suppressed_note TEXT,                                       -- shown if subgroup data suppressed
  
  -- Rotation / lifecycle
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,                        -- higher = shown first
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track which insights a user has already seen (fatigue control)
CREATE TABLE public.insight_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  insight_id UUID NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, insight_id)
);

-- Enable RLS
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_views ENABLE ROW LEVEL SECURITY;

-- Insights are readable by any authenticated user (filtered by school in queries)
CREATE POLICY "Authenticated users can read insights"
  ON public.insights FOR SELECT
  TO authenticated
  USING (true);

-- Insight views: users can only see/manage their own
CREATE POLICY "Users can view own insight_views"
  ON public.insight_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insight_views"
  ON public.insight_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_insights_updated_at
  BEFORE UPDATE ON public.insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_insights_school_active ON public.insights(school_id, priority DESC, active_from DESC);
CREATE INDEX idx_insight_views_user ON public.insight_views(user_id, insight_id);
