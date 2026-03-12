
-- Add soft-delete columns to children
ALTER TABLE public.children
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN archived_at timestamptz;

-- Allow users to update their own children (needed for soft-delete)
CREATE POLICY "Users can update own children"
  ON public.children
  FOR UPDATE
  USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);
