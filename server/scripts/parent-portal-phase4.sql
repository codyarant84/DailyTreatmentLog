-- Phase 4: Parent Portal — parent-athlete linking and injury visibility

-- Join table linking parent portal accounts to their athletes
CREATE TABLE IF NOT EXISTS portal_parent_athlete (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  athlete_id  uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  linked_at   timestamptz DEFAULT now(),
  UNIQUE (parent_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_parent_athlete_parent ON portal_parent_athlete(parent_id);
CREATE INDEX IF NOT EXISTS idx_portal_parent_athlete_athlete ON portal_parent_athlete(athlete_id);

-- Visibility flags per injury for parent portal (defaults to all visible)
ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS parent_visibility jsonb NOT NULL DEFAULT '{"status":true,"body_part":true,"notes":false}'::jsonb;
