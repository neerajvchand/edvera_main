
-- Create action_items table
CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  event_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  severity numeric,
  requires_action boolean DEFAULT false,
  tags text[] DEFAULT '{}'::text[],
  source_kind text NOT NULL DEFAULT 'user',
  source_label text,
  source_url text,
  source_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own action items"
  ON public.action_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own action items"
  ON public.action_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action items"
  ON public.action_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own action items"
  ON public.action_items FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_action_items_user_status ON public.action_items (user_id, status);
CREATE INDEX idx_action_items_user_due ON public.action_items (user_id, due_at);
CREATE INDEX idx_action_items_user_created ON public.action_items (user_id, created_at);

-- Updated_at trigger
CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
