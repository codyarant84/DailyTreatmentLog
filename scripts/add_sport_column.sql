-- Add sport column to daily_treatments
ALTER TABLE public.daily_treatments ADD COLUMN IF NOT EXISTS sport text;
