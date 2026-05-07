CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS template_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint VARCHAR(500) NOT NULL UNIQUE,
  sheet_name VARCHAR(120) NOT NULL,
  header_row_index INTEGER NOT NULL,
  headers JSONB NOT NULL,
  mapping JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_code VARCHAR(120),
  sender_name VARCHAR(80) NOT NULL,
  sender_phone VARCHAR(40) NOT NULL,
  sender_address TEXT NOT NULL,
  receiver_name VARCHAR(80) NOT NULL,
  receiver_phone VARCHAR(40) NOT NULL,
  receiver_address TEXT NOT NULL,
  weight_kg NUMERIC(10, 3) NOT NULL,
  quantity INTEGER NOT NULL,
  temperature VARCHAR(20) NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  source_template_name VARCHAR(160),
  source_sheet_name VARCHAR(120),
  source_fingerprint VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipping_orders_external_code_unique UNIQUE NULLS NOT DISTINCT (external_code)
);

CREATE INDEX IF NOT EXISTS shipping_orders_created_at_idx
  ON shipping_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS shipping_orders_external_code_idx
  ON shipping_orders (external_code);

CREATE INDEX IF NOT EXISTS shipping_orders_receiver_name_idx
  ON shipping_orders (receiver_name);

CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS template_rules_set_timestamp ON template_rules;
CREATE TRIGGER template_rules_set_timestamp
BEFORE UPDATE ON template_rules
FOR EACH ROW
EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS shipping_orders_set_timestamp ON shipping_orders;
CREATE TRIGGER shipping_orders_set_timestamp
BEFORE UPDATE ON shipping_orders
FOR EACH ROW
EXECUTE FUNCTION set_timestamp();
