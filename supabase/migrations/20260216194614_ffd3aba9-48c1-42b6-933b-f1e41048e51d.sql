
-- Add lifecycle columns to action_items
ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz DEFAULT NULL;
