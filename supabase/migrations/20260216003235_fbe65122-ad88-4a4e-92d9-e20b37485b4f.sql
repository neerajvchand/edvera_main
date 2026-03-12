
-- Create attendance_entries table
CREATE TABLE public.attendance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  reason text,
  period text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_entries_child_date_unique UNIQUE (child_id, attendance_date)
);

-- Enable RLS
ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;

-- Security definer to check child ownership
CREATE OR REPLACE FUNCTION public.user_owns_child(p_user_id uuid, p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id AND parent_id = p_user_id
  );
$$;

-- RLS policies
CREATE POLICY "Users can read own children attendance"
  ON public.attendance_entries FOR SELECT
  USING (public.user_owns_child(auth.uid(), child_id));

CREATE POLICY "Users can insert own children attendance"
  ON public.attendance_entries FOR INSERT
  WITH CHECK (public.user_owns_child(auth.uid(), child_id));

CREATE POLICY "Users can update own children attendance"
  ON public.attendance_entries FOR UPDATE
  USING (public.user_owns_child(auth.uid(), child_id));

CREATE POLICY "Users can delete own children attendance"
  ON public.attendance_entries FOR DELETE
  USING (public.user_owns_child(auth.uid(), child_id));

-- Timestamp trigger
CREATE TRIGGER update_attendance_entries_updated_at
  BEFORE UPDATE ON public.attendance_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for query performance
CREATE INDEX idx_attendance_entries_child_date ON public.attendance_entries(child_id, attendance_date DESC);
