
-- Create board_meetings table
CREATE TABLE public.board_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  title text NOT NULL,
  source_url text,
  summary_short text,
  key_topics text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.board_meetings ENABLE ROW LEVEL SECURITY;

-- Public read for all authenticated users (board content is public)
CREATE POLICY "Authenticated users can read board meetings"
  ON public.board_meetings FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies — admin-only via service role

-- Indexes
CREATE INDEX idx_board_meetings_district_id ON public.board_meetings(district_id);
CREATE INDEX idx_board_meetings_meeting_date ON public.board_meetings(meeting_date DESC);

-- Timestamp trigger
CREATE TRIGGER update_board_meetings_updated_at
  BEFORE UPDATE ON public.board_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
