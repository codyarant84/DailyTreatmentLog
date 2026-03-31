-- Run in Supabase SQL Editor

-- 1. Injuries table
CREATE TABLE IF NOT EXISTS public.injuries (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id        uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  school_id         uuid NOT NULL,
  logged_by         uuid,
  injury_date       date NOT NULL,
  body_part         text NOT NULL,
  injury_type       text NOT NULL,  -- Sprain, Strain, Contusion, Fracture, Tendinopathy, Overuse, Laceration, Concussion, Other
  mechanism         text,           -- Contact, Non-contact, Overuse, Unknown
  severity          text,           -- Mild, Moderate, Severe
  rtp_status        text NOT NULL DEFAULT 'Out',  -- Full Participation, Limited Participation, Out, Cleared
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

-- 2. Add injury_id FK to daily_treatments
ALTER TABLE public.daily_treatments
  ADD COLUMN IF NOT EXISTS injury_id uuid REFERENCES public.injuries(id) ON DELETE SET NULL;
