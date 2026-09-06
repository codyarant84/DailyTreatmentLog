-- High Risk Flag system migration
-- Adds the clearance_status column the "Overdue Clearance" risk flag depends
-- on (injuries has no such concept yet — rtp_status/is_active track return-
-- to-play, not physician sign-off). Safe to re-run.

ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS clearance_status text
    CHECK (clearance_status IN ('pending_physician', 'cleared', 'not_required'));
