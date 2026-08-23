-- CEU Library migration
-- Community-sourced database of free continuing education for athletic
-- trainers, with personal tracking toward BOC recertification.
-- Safe to re-run (IF NOT EXISTS guards)

CREATE TABLE IF NOT EXISTS ceu_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  provider text NOT NULL,
  credit_hours numeric(4,1) NOT NULL,
  url text NOT NULL,
  description text,
  is_free boolean DEFAULT true,
  cost numeric(8,2),
  expiration_date date,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ceu_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ceu_id uuid REFERENCES ceu_library(id) ON DELETE SET NULL,
  title text NOT NULL,
  provider text,
  credit_hours numeric(4,1) NOT NULL,
  completed_date date NOT NULL,
  certificate_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceu_library_approved ON ceu_library(approved);
CREATE INDEX IF NOT EXISTS idx_ceu_completions_profile ON ceu_completions(profile_id);

-- Seed library with well-known free CEU sources (pre-approved, platform-curated)
INSERT INTO ceu_library (title, provider, credit_hours, url, description, is_free, approved)
SELECT * FROM (VALUES
  ('NATA Free Member Webinars', 'NATA', 1.0::numeric(4,1), 'https://www.nata.org', 'Free webinars for NATA members covering clinical practice, EBP, and professional development topics. Hours vary by webinar.', true, true),
  ('NSCA Free CEU Opportunities', 'NSCA', 1.0::numeric(4,1), 'https://www.nsca.com', 'Free continuing education content from the National Strength and Conditioning Association. Hours vary by course.', true, true),
  ('EBSCOlearning Free Courses', 'EBSCOlearning', 1.0::numeric(4,1), 'https://www.ebscolearning.com', 'On-demand continuing education courses for allied health professionals, including free offerings. Hours vary by course.', true, true),
  ('CDC HEADS UP Concussion Training', 'CDC', 1.0::numeric(4,1), 'https://www.cdc.gov/headsup', 'Free online training on concussion recognition, response, and management for athletic trainers and coaches.', true, true),
  ('NFHS Learning Center Courses', 'NFHS', 1.0::numeric(4,1), 'https://www.nfhs.org', 'Free online courses from the National Federation of State High School Associations covering sports safety and administration. Hours vary by course.', true, true),
  ('American Red Cross Free Resources', 'American Red Cross', 1.0::numeric(4,1), 'https://www.redcross.org', 'Free training resources and guides on first aid, CPR/AED, and emergency preparedness.', true, true),
  ('Korey Stringer Institute Resources', 'Korey Stringer Institute', 1.0::numeric(4,1), 'https://ksi.uconn.edu', 'Free research-based resources on exertional heat illness, sudden cardiac arrest, and other causes of sudden death in sport.', true, true),
  ('NATA Foundation Resources', 'NATA Foundation', 1.0::numeric(4,1), 'https://www.natafoundation.org', 'Free educational resources and research summaries from the NATA Foundation supporting athletic training research and education.', true, true),
  ('MedBridge Free Content', 'MedBridge', 1.0::numeric(4,1), 'https://www.medbridgeeducation.com', 'Selected free continuing education content from MedBridge''s clinical education library. Hours vary by course.', true, true),
  ('ACSM Free Resources', 'ACSM', 1.0::numeric(4,1), 'https://www.acsm.org', 'Free resources and continuing education content from the American College of Sports Medicine. Hours vary by course.', true, true)
) AS seed (title, provider, credit_hours, url, description, is_free, approved)
WHERE NOT EXISTS (SELECT 1 FROM ceu_library WHERE ceu_library.title = seed.title);
