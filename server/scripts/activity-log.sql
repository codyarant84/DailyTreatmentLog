-- Activity log table for school engagement tracking
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        REFERENCES schools(id) ON DELETE CASCADE,
  profile_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_school   ON activity_log(school_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created  ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action   ON activity_log(action);
