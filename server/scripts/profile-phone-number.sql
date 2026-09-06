-- Personal phone number per trainer, used to identify inbound SMS
-- treatment-log messages. Safe to re-run.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;
