-- Inventory Management. Safe to re-run.

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('consumable', 'non_consumable', 'medication', 'equipment')),
  subcategory text,
  description text,
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'each',
  low_stock_threshold numeric(10,2),
  location text,
  brand text,
  sku text,
  cost_per_unit numeric(10,2),
  is_controlled_substance boolean DEFAULT false,
  requires_prescription boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Not in the original spec — medications need expiration/lot tracking at the
-- item level (controlled_substance_log tracks this per-shipment for
-- controlled substances specifically, but non-controlled medications have
-- nowhere else to record it, and the expiring-medications alert has nothing
-- to query without this).
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expiration_date date;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lot_number text;

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('restock', 'use', 'adjust', 'checkout', 'return', 'expired', 'damaged')),
  quantity numeric(10,2) NOT NULL,
  previous_quantity numeric(10,2) NOT NULL,
  new_quantity numeric(10,2) NOT NULL,
  athlete_id uuid REFERENCES athletes(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  due_date date,
  returned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlled_substance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('administered', 'wasted', 'received', 'returned')),
  quantity numeric(10,2) NOT NULL,
  athlete_id uuid REFERENCES athletes(id) ON DELETE SET NULL,
  administered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  witness uuid REFERENCES profiles(id) ON DELETE SET NULL,
  physician_order text,
  lot_number text,
  expiration_date date,
  reason text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_school ON inventory_items(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_school ON inventory_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_controlled_substance_log_school ON controlled_substance_log(school_id);

-- Not in the original spec — needed so POST /api/inventory/check-alerts (a
-- sweep meant to be called repeatedly, e.g. by a cron) doesn't re-email the
-- same alert every time it runs. Mirrors at_credential_alerts' role for the
-- credential-expiration sweep.
CREATE TABLE IF NOT EXISTS inventory_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock', 'overdue_checkout', 'expiring_medication')),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES inventory_transactions(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_log_school ON inventory_alert_log(school_id);
