-- Scheduling migration
-- AT availability blocks + athlete-submitted treatment requests.
-- Safe to re-run (IF NOT EXISTS guards)

CREATE TABLE IF NOT EXISTS schedule_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  specific_date date,
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes int NOT NULL DEFAULT 15,
  max_athletes_per_slot int NOT NULL DEFAULT 3,
  is_recurring boolean DEFAULT true,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS treatment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  portal_user_id uuid REFERENCES portal_users(id) ON DELETE SET NULL,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  reason text NOT NULL,
  body_part text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  auto_approved boolean DEFAULT false,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_avail_school ON schedule_availability(school_id);
CREATE INDEX IF NOT EXISTS idx_schedule_avail_date ON schedule_availability(specific_date);
CREATE INDEX IF NOT EXISTS idx_treatment_requests_school ON treatment_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_treatment_requests_date ON treatment_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_treatment_requests_athlete ON treatment_requests(athlete_id);
