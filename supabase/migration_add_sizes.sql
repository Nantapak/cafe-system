-- ============================================
--  Migration: เพิ่ม Size ต่อเมนู
--  รัน SQL นี้ใน Supabase → SQL Editor (New query)
-- ============================================

-- 1) ตาราง size ต่อสินค้า
CREATE TABLE product_sizes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,            -- เช่น S / M / L หรือ เล็ก / กลาง / ใหญ่
  price      NUMERIC(10,2) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_sizes_product ON product_sizes(product_id);

ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_product_sizes"
  ON product_sizes FOR ALL USING (true) WITH CHECK (true);

-- 2) เพิ่ม size_id ใน product_ingredients (nullable = ใช้กับทุก size)
ALTER TABLE product_ingredients
  ADD COLUMN size_id UUID REFERENCES product_sizes(id) ON DELETE CASCADE;

-- 3) ปรับ unique constraint ให้รองรับ size_id
--    (ลบเก่า แล้วสร้าง partial index ใหม่)
ALTER TABLE product_ingredients
  DROP CONSTRAINT IF EXISTS product_ingredients_product_id_inventory_id_key;
ALTER TABLE product_ingredients
  DROP CONSTRAINT IF EXISTS product_ingredients_unique;

-- ไม่มี size → unique (product_id, inventory_id)
CREATE UNIQUE INDEX product_ingredients_no_size_uq
  ON product_ingredients(product_id, inventory_id)
  WHERE size_id IS NULL;

-- มี size → unique (product_id, inventory_id, size_id)
CREATE UNIQUE INDEX product_ingredients_with_size_uq
  ON product_ingredients(product_id, inventory_id, size_id)
  WHERE size_id IS NOT NULL;

-- ============================================
--  Seed: ตัวอย่าง Size สำหรับเมนูกาแฟเย็น
-- ============================================
INSERT INTO product_sizes (product_id, name, price, sort_order)
SELECT id, 'S', 50, 1 FROM products WHERE name = 'อเมริกาโน่เย็น'
UNION ALL
SELECT id, 'M', 60, 2 FROM products WHERE name = 'อเมริกาโน่เย็น'
UNION ALL
SELECT id, 'L', 70, 3 FROM products WHERE name = 'อเมริกาโน่เย็น';

INSERT INTO product_sizes (product_id, name, price, sort_order)
SELECT id, 'S', 55, 1 FROM products WHERE name = 'ลาเต้เย็น'
UNION ALL
SELECT id, 'M', 65, 2 FROM products WHERE name = 'ลาเต้เย็น'
UNION ALL
SELECT id, 'L', 75, 3 FROM products WHERE name = 'ลาเต้เย็น';

INSERT INTO product_sizes (product_id, name, price, sort_order)
SELECT id, 'S', 60, 1 FROM products WHERE name = 'มอคค่าเย็น'
UNION ALL
SELECT id, 'M', 70, 2 FROM products WHERE name = 'มอคค่าเย็น'
UNION ALL
SELECT id, 'L', 80, 3 FROM products WHERE name = 'มอคค่าเย็น';

INSERT INTO product_sizes (product_id, name, price, sort_order)
SELECT id, 'S', 65, 1 FROM products WHERE name = 'คาราเมล มัคคิอาโต'
UNION ALL
SELECT id, 'M', 75, 2 FROM products WHERE name = 'คาราเมล มัคคิอาโต'
UNION ALL
SELECT id, 'L', 85, 3 FROM products WHERE name = 'คาราเมล มัคคิอาโต';

-- ============================================
--  Seed: ส่วนผสมแยกตาม Size (ลาเต้เย็น)
--  ลบส่วนผสมเดิมของลาเต้เย็นก่อน แล้วใส่แบบแยก size
-- ============================================
DELETE FROM product_ingredients
  WHERE product_id = (SELECT id FROM products WHERE name = 'ลาเต้เย็น');

-- ลาเต้เย็น S
INSERT INTO product_ingredients (product_id, inventory_id, size_id, quantity)
SELECT p.id, i.id,
  (SELECT id FROM product_sizes WHERE product_id = p.id AND name = 'S'),
  14
FROM products p, inventory i WHERE p.name = 'ลาเต้เย็น' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, size_id, quantity)
SELECT p.id, i.id,
  (SELECT id FROM product_sizes WHERE product_id = p.id AND name = 'S'),
  100
FROM products p, inventory i WHERE p.name = 'ลาเต้เย็น' AND i.name = 'นมสด';

-- ลาเต้เย็น M
INSERT INTO product_ingredients (product_id, inventory_id, size_id, quantity)
SELECT p.id, i.id,
  (SELECT id FROM product_sizes WHERE product_id = p.id AND name = 'M'),
  18
FROM products p, inventory i WHERE p.name = 'ลาเต้เย็น' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, size_id, quantity)
SELECT p.id, i.id,
  (SELECT id FROM product_sizes WHERE product_id = p.id AND name = 'M'),
  150
FROM products p, inventory i WHERE p.name = 'ลาเต้เย็น' AND i.name = 'นมสด';

-- ลาเต้เย็น L
INSERT INTO product_ingredients (product_id, inventory_id, size_id, quantity)
SELECT p.id, i.id,
  (SELECT id FROM product_sizes WHERE product_id = p.id AND name = 'L'),
  22
FROM products p, inventory i WHERE p.name = 'ลาเต้เย็น' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, size_id, quantity)
SELECT p.id, i.id,
  (SELECT id FROM product_sizes WHERE product_id = p.id AND name = 'L'),
  200
FROM products p, inventory i WHERE p.name = 'ลาเต้เย็น' AND i.name = 'นมสด';

-- ถ้วย L ใช้กับทุก size (size_id = NULL)
INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ลาเต้เย็น' AND i.name = 'ถ้วย L (เย็น)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ลาเต้เย็น' AND i.name = 'หลอด';
