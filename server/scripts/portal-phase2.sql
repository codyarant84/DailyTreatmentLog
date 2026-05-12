-- Portal Phase 2 migration
-- Safe to re-run (IF NOT EXISTS guards)

CREATE TABLE IF NOT EXISTS portal_forms (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  description         text,
  is_template         boolean     DEFAULT false,
  template_name       text,
  requires_signature  boolean     DEFAULT true,
  requires_parent     boolean     DEFAULT false,
  requires_athlete    boolean     DEFAULT false,
  created_by          uuid        REFERENCES profiles(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_forms_school_id_idx ON portal_forms (school_id);

CREATE TABLE IF NOT EXISTS portal_form_fields (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid  NOT NULL REFERENCES portal_forms(id) ON DELETE CASCADE,
  field_type  text  NOT NULL CHECK (field_type IN ('text','textarea','checkbox','date','select','heading','paragraph')),
  label       text  NOT NULL,
  placeholder text,
  options     jsonb,
  required    boolean     DEFAULT false,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_form_fields_form_id_idx ON portal_form_fields (form_id);

CREATE TABLE IF NOT EXISTS portal_form_assignments (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid  NOT NULL REFERENCES portal_forms(id) ON DELETE CASCADE,
  school_id   uuid  NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  athlete_id  uuid  REFERENCES athletes(id) ON DELETE CASCADE,
  assigned_to text  NOT NULL CHECK (assigned_to IN ('athlete','parent','both')),
  due_date    date,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_form_assignments_school_id_idx  ON portal_form_assignments (school_id);
CREATE INDEX IF NOT EXISTS portal_form_assignments_athlete_id_idx ON portal_form_assignments (athlete_id);

CREATE TABLE IF NOT EXISTS portal_form_submissions (
  id                uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     uuid  NOT NULL REFERENCES portal_form_assignments(id) ON DELETE CASCADE,
  portal_user_id    uuid  REFERENCES portal_users(id) ON DELETE SET NULL,
  submitted_by_role text  NOT NULL CHECK (submitted_by_role IN ('athlete','parent')),
  responses         jsonb NOT NULL DEFAULT '{}',
  signature_data    text,
  pdf_upload_url    text,
  submitted_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_form_submissions_assignment_id_idx ON portal_form_submissions (assignment_id);
