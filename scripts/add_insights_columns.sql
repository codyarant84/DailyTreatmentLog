-- Run in Supabase SQL Editor

-- 1. Editable cost-per-visit rate for the Program Summary section
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS cost_per_visit numeric(8,2) DEFAULT 50;

-- 2. Track when an injury was cleared (enables avg days-to-RTP calculation)
ALTER TABLE public.injuries
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz;
