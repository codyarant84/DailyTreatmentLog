-- SMS-to-Injury Log feature. Safe to re-run.

ALTER TABLE injuries ADD COLUMN IF NOT EXISTS logged_via_sms boolean DEFAULT false;

-- Registered AT phone numbers used to identify inbound SMS injury reports.
-- verification_code / verification_code_expires_at hold the pending 6-digit
-- code between POST /api/phone-numbers and POST /api/phone-numbers/verify —
-- not in the original spec, but required for that flow to actually persist
-- the code somewhere between the two requests.
CREATE TABLE IF NOT EXISTS at_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  verified boolean DEFAULT false,
  verification_code text,
  verification_code_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(phone_number)
);
