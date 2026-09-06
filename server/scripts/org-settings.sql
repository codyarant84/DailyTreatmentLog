-- Organization type settings, grade advancement, and archive management
-- Safe to re-run.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS organization_type text DEFAULT 'high_school'
    CHECK (organization_type IN ('high_school', 'college', 'semi_pro', 'club'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS max_years int DEFAULT 4;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS archive_retention_years int DEFAULT 3;

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS archived_reason text;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS graduation_year int;
-- College only: when true, this athlete is never auto-archived by the
-- advance-year operation regardless of year level (redshirt / graduate
-- transfer / medical hardship).
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS eligibility_override boolean DEFAULT false;
