-- Run in Supabase SQL Editor
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS emergency_contact_name  text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
