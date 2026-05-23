-- ============================================
--  ระบบร้านกาแฟ — Supabase Database Schema
-- ============================================

-- หมวดหมู่สินค้า
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  sort_order INT  DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- สินค้า / เมนู
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL,
  image_url   TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ออเดอร์
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','preparing','ready','completed','cancelled')),
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- รายการในออเดอร์
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  price      NUMERIC(10,2) NOT NULL,
  quantity   INT  NOT NULL DEFAULT 1,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- วัตถุดิบ / สต็อก
CREATE TABLE inventory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'กรัม',
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ประวัติการเคลื่อนไหวสต็อก
CREATE TABLE inventory_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('in','out','adjust')),
  quantity     NUMERIC(10,2) NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
--  Indexes
-- ============================================
CREATE INDEX idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_products_category   ON products(category_id);

-- ============================================
--  ฟังก์ชัน auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
--  Row Level Security (RLS) — ให้ public อ่าน/เขียนได้
--  (ปรับให้เข้มงวดขึ้นเมื่อเพิ่ม Auth)
-- ============================================
ALTER TABLE categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_categories"             ON categories             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products"               ON products               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orders"                 ON orders                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_order_items"            ON order_items            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory"              ON inventory              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory_transactions" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
--  ข้อมูลตัวอย่าง (Seed Data)
-- ============================================
INSERT INTO categories (name, sort_order) VALUES
  ('กาแฟร้อน',  1),
  ('กาแฟเย็น',  2),
  ('ชา',        3),
  ('เครื่องดื่มอื่น', 4),
  ('ขนม / อาหาร', 5);

INSERT INTO products (category_id, name, price, is_available) VALUES
  ((SELECT id FROM categories WHERE name='กาแฟร้อน'), 'อเมริกาโน่ร้อน',   45, true),
  ((SELECT id FROM categories WHERE name='กาแฟร้อน'), 'ลาเต้ร้อน',        55, true),
  ((SELECT id FROM categories WHERE name='กาแฟร้อน'), 'คาปูชิโน่ร้อน',    55, true),
  ((SELECT id FROM categories WHERE name='กาแฟร้อน'), 'เอสเปรสโซ่',       40, true),
  ((SELECT id FROM categories WHERE name='กาแฟเย็น'), 'อเมริกาโน่เย็น',   50, true),
  ((SELECT id FROM categories WHERE name='กาแฟเย็น'), 'ลาเต้เย็น',        60, true),
  ((SELECT id FROM categories WHERE name='กาแฟเย็น'), 'มอคค่าเย็น',       65, true),
  ((SELECT id FROM categories WHERE name='กาแฟเย็น'), 'คาราเมล มัคคิอาโต', 70, true),
  ((SELECT id FROM categories WHERE name='ชา'),        'ชาไทยร้อน',        40, true),
  ((SELECT id FROM categories WHERE name='ชา'),        'ชาไทยเย็น',        45, true),
  ((SELECT id FROM categories WHERE name='ชา'),        'ชามะนาว',          45, true),
  ((SELECT id FROM categories WHERE name='ชา'),        'ชาเขียวมัทฉะ',     55, true),
  ((SELECT id FROM categories WHERE name='เครื่องดื่มอื่น'), 'โกโก้ร้อน',  50, true),
  ((SELECT id FROM categories WHERE name='เครื่องดื่มอื่น'), 'โกโก้เย็น',  55, true),
  ((SELECT id FROM categories WHERE name='เครื่องดื่มอื่น'), 'น้ำส้มคั้น',  60, true),
  ((SELECT id FROM categories WHERE name='ขนม / อาหาร'), 'ครัวซองต์',      45, true),
  ((SELECT id FROM categories WHERE name='ขนม / อาหาร'), 'เค้กช็อกโกแลต',  65, true),
  ((SELECT id FROM categories WHERE name='ขนม / อาหาร'), 'สแกนดิเนเวียนโรล', 55, true);

INSERT INTO inventory (name, unit, quantity, min_quantity, cost_per_unit) VALUES
  ('เมล็ดกาแฟ',     'กรัม',  5000, 1000, 0.50),
  ('นมสด',          'มล.',   10000, 2000, 0.05),
  ('น้ำตาล',        'กรัม',  3000,  500, 0.02),
  ('ชาไทย',         'กรัม',  2000,  400, 0.30),
  ('ผงโกโก้',       'กรัม',  1500,  300, 0.40),
  ('น้ำเชื่อม',     'มล.',   2000,  400, 0.06),
  ('ครีม',          'มล.',   1000,  200, 0.10),
  ('ถ้วย M (ร้อน)', 'ชิ้น', 200,    50, 2.00),
  ('ถ้วย L (เย็น)', 'ชิ้น', 200,    50, 2.50),
  ('หลอด',          'ชิ้น', 500,   100, 0.50);
