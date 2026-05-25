-- ══════════════════════════════════════════════════════
--  ระบบสมาชิก + สะสมแต้ม
--  รัน SQL Editor ใน Supabase Dashboard
-- ══════════════════════════════════════════════════════

-- 1. ตารางสมาชิก
CREATE TABLE IF NOT EXISTS customers (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  phone       TEXT        UNIQUE NOT NULL,
  points      INT         NOT NULL DEFAULT 0,
  total_cups  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ประวัติแต้ม
CREATE TABLE IF NOT EXISTS point_transactions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID        REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  order_id    UUID        REFERENCES orders(id)    ON DELETE SET NULL,
  points_change INT       NOT NULL,   -- บวก = ได้แต้ม, ลบ = ใช้แต้ม
  type        TEXT        NOT NULL,   -- 'earn' | 'redeem' | 'adjust'
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. เพิ่ม column ใน orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount      NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_earned INT           DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed INT         DEFAULT 0;

-- 4. Index สำหรับค้นหาเร็ว
CREATE INDEX IF NOT EXISTS idx_customers_phone     ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_point_tx_customer   ON point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer     ON orders(customer_id);
