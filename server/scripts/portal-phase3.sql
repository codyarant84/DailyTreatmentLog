-- Portal Phase 3: Athlete Onboarding
-- Run: psql "$DATABASE_URL" -f server/scripts/portal-phase3.sql

ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS jersey_number text;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS gender text;

CREATE TABLE IF NOT EXISTS athlete_emergency_contacts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    uuid        NOT NULL UNIQUE REFERENCES athletes(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  relationship  text,
  phone         text,
  email         text,
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS athlete_insurance (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid        NOT NULL UNIQUE REFERENCES athletes(id) ON DELETE CASCADE,
  provider         text,
  policy_number    text,
  group_number     text,
  subscriber_name  text,
  updated_at       timestamptz DEFAULT now()
);
