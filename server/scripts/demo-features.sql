-- Feature 1: Coach sport filtering
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sport text;

-- Feature 2: Athlete flags
CREATE TABLE IF NOT EXISTS athlete_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('allergy', 'medical_condition', 'injury_history', 'other')),
  description text NOT NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now()
);

-- Feature 3: Injury attachments (Dr. notes)
CREATE TABLE IF NOT EXISTS injury_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id uuid NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_by uuid REFERENCES profiles(id),
  uploaded_at timestamptz DEFAULT now()
);

-- Feature 4: Auto end-of-day report settings
CREATE TABLE IF NOT EXISTS auto_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  send_time time DEFAULT '17:00',
  recipients text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
