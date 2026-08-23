-- General Medical migration
-- Non-injury medical events: heat illness, general illness, skin conditions,
-- cardiac events, diabetes, asthma, etc.
-- Safe to re-run (IF NOT EXISTS guards)

CREATE TABLE IF NOT EXISTS general_medical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  logged_by uuid REFERENCES profiles(id),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  event_time time,
  category text NOT NULL CHECK (category IN ('heat_illness', 'illness', 'skin_condition', 'cardiac', 'diabetes', 'asthma', 'other')),
  subcategory text,
  chief_complaint text NOT NULL,
  treatment_administered text,
  disposition text NOT NULL CHECK (disposition IN ('returned_to_activity', 'sent_home', 'transported_to_er', 'parent_contacted', 'physician_referral')),
  follow_up_required boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gen_med_school ON general_medical(school_id);
CREATE INDEX IF NOT EXISTS idx_gen_med_athlete ON general_medical(athlete_id);
