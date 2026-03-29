-- Add attendance contact fields to schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS attendance_phone text,
  ADD COLUMN IF NOT EXISTS attendance_extension text;