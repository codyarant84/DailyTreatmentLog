-- AT Document Vault migration
-- Personal credential/document storage for athletic trainers, with expiration alerts.
-- Safe to re-run (IF NOT EXISTS guards)

CREATE TABLE IF NOT EXISTS at_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('cpr_aed', 'boc', 'state_licensure', 'nata', 'npi', 'insurance', 'other')),
  credential_name text,
  credential_number text,
  issuing_state text,
  issued_date date,
  expiration_date date,
  file_url text,
  file_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_at_credentials_profile ON at_credentials(profile_id);

CREATE TABLE IF NOT EXISTS at_credential_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES at_credentials(id) ON DELETE CASCADE,
  alert_sent_at timestamptz,
  days_before int NOT NULL DEFAULT 60,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_at_credential_alerts_credential ON at_credential_alerts(credential_id);
