-- Fix RDS schema: add missing tables and columns
-- Run with: psql "$DATABASE_URL" -f server/scripts/fix-rds-schema.sql

-- ── rtp_protocols ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rtp_protocols (
  id           bigserial    PRIMARY KEY,
  school_id    uuid         NOT NULL,
  step_number  int          NOT NULL,
  step_name    text         NOT NULL,
  description  text,
  UNIQUE (school_id, step_number)
);

-- ── concussion_cases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concussion_cases (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id             uuid         NOT NULL,
  school_id              uuid         NOT NULL,
  opened_by              uuid,
  injury_id              uuid,
  injury_date            date,
  mechanism              text,
  loss_of_consciousness  boolean,
  loc_duration_seconds   int,
  physician_name         text,
  physician_cleared_at   timestamptz,
  notes                  text,
  status                 text         NOT NULL DEFAULT 'active',
  current_step           int          NOT NULL DEFAULT 1,
  opened_at              timestamptz  NOT NULL DEFAULT now(),
  cleared_at             timestamptz
);

-- ── concussion_checkins symptom columns ───────────────────────────────
ALTER TABLE concussion_checkins
  ADD COLUMN IF NOT EXISTS headache                 int,
  ADD COLUMN IF NOT EXISTS pressure_in_head         int,
  ADD COLUMN IF NOT EXISTS neck_pain                int,
  ADD COLUMN IF NOT EXISTS nausea_or_vomiting       int,
  ADD COLUMN IF NOT EXISTS dizziness                int,
  ADD COLUMN IF NOT EXISTS blurred_vision           int,
  ADD COLUMN IF NOT EXISTS balance_problems         int,
  ADD COLUMN IF NOT EXISTS sensitivity_to_light     int,
  ADD COLUMN IF NOT EXISTS sensitivity_to_noise     int,
  ADD COLUMN IF NOT EXISTS feeling_slowed_down      int,
  ADD COLUMN IF NOT EXISTS feeling_in_fog           int,
  ADD COLUMN IF NOT EXISTS dont_feel_right          int,
  ADD COLUMN IF NOT EXISTS difficulty_concentrating int,
  ADD COLUMN IF NOT EXISTS difficulty_remembering   int,
  ADD COLUMN IF NOT EXISTS fatigue_or_low_energy    int,
  ADD COLUMN IF NOT EXISTS confusion                int,
  ADD COLUMN IF NOT EXISTS drowsiness               int,
  ADD COLUMN IF NOT EXISTS more_emotional           int,
  ADD COLUMN IF NOT EXISTS irritability             int,
  ADD COLUMN IF NOT EXISTS sadness                  int,
  ADD COLUMN IF NOT EXISTS nervous_or_anxious       int,
  ADD COLUMN IF NOT EXISTS visual_problems          int;

-- ── concussion_assessments symptom + assessment columns ───────────────
ALTER TABLE concussion_assessments
  ADD COLUMN IF NOT EXISTS headache                 int,
  ADD COLUMN IF NOT EXISTS pressure_in_head         int,
  ADD COLUMN IF NOT EXISTS neck_pain                int,
  ADD COLUMN IF NOT EXISTS nausea_or_vomiting       int,
  ADD COLUMN IF NOT EXISTS dizziness                int,
  ADD COLUMN IF NOT EXISTS blurred_vision           int,
  ADD COLUMN IF NOT EXISTS balance_problems         int,
  ADD COLUMN IF NOT EXISTS sensitivity_to_light     int,
  ADD COLUMN IF NOT EXISTS sensitivity_to_noise     int,
  ADD COLUMN IF NOT EXISTS feeling_slowed_down      int,
  ADD COLUMN IF NOT EXISTS feeling_in_fog           int,
  ADD COLUMN IF NOT EXISTS dont_feel_right          int,
  ADD COLUMN IF NOT EXISTS difficulty_concentrating int,
  ADD COLUMN IF NOT EXISTS difficulty_remembering   int,
  ADD COLUMN IF NOT EXISTS fatigue_or_low_energy    int,
  ADD COLUMN IF NOT EXISTS confusion                int,
  ADD COLUMN IF NOT EXISTS drowsiness               int,
  ADD COLUMN IF NOT EXISTS more_emotional           int,
  ADD COLUMN IF NOT EXISTS irritability             int,
  ADD COLUMN IF NOT EXISTS sadness                  int,
  ADD COLUMN IF NOT EXISTS nervous_or_anxious       int,
  ADD COLUMN IF NOT EXISTS visual_problems          int,
  ADD COLUMN IF NOT EXISTS assessment_type          text,
  ADD COLUMN IF NOT EXISTS is_baseline              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_by_athlete     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bess_firm_double         int,
  ADD COLUMN IF NOT EXISTS bess_firm_single         int,
  ADD COLUMN IF NOT EXISTS bess_firm_tandem         int,
  ADD COLUMN IF NOT EXISTS bess_foam_double         int,
  ADD COLUMN IF NOT EXISTS bess_foam_single         int,
  ADD COLUMN IF NOT EXISTS bess_foam_tandem         int;
