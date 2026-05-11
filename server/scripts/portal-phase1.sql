-- Portal Phase 1 migration
-- Safe to re-run (all statements use IF NOT EXISTS / IF NOT EXISTS guards)

-- Add student email domain to schools for Google auto-association
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS student_email_domain text;

-- Portal users (athletes and parents who log into the portal)
CREATE TABLE IF NOT EXISTS portal_users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  athlete_id    uuid        REFERENCES athletes(id) ON DELETE SET NULL,
  email         text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('athlete', 'parent')),
  google_id     text        UNIQUE,
  password_hash text,
  avatar_url    text,
  approved      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_users_school_id_idx ON portal_users (school_id);
CREATE INDEX IF NOT EXISTS portal_users_athlete_id_idx ON portal_users (athlete_id);

-- Many-to-many: a parent can be linked to multiple athletes
CREATE TABLE IF NOT EXISTS portal_parent_athlete (
  parent_id  uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES athletes(id)     ON DELETE CASCADE,
  PRIMARY KEY (parent_id, athlete_id)
);

-- Invite tokens sent by ATs to parents/athletes
CREATE TABLE IF NOT EXISTS portal_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  athlete_id uuid        REFERENCES athletes(id)          ON DELETE SET NULL,
  email      text        NOT NULL,
  role       text        NOT NULL CHECK (role IN ('athlete', 'parent')),
  token      text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_invites_token_idx ON portal_invites (token);
