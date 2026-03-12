
-- Update existing children to use school UUID instead of slug
UPDATE public.children 
SET school_id = 'a1b2c3d4-0001-4000-8000-000000000001' 
WHERE school_id = 'bayside-smfcsd';

-- Change default to UUID
ALTER TABLE public.children 
ALTER COLUMN school_id SET DEFAULT 'a1b2c3d4-0001-4000-8000-000000000001';
