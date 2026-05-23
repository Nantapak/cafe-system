-- ============================================
--  Migration: เพิ่มตาราง product_ingredients
--  รัน SQL นี้ใน Supabase → SQL Editor
-- ============================================

-- ส่วนผสมต่อเมนู (กี่หน่วยต่อ 1 แก้ว)
CREATE TABLE product_ingredients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id)  ON DELETE CASCADE,
  quantity     NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, inventory_id)
);

CREATE INDEX idx_product_ingredients_product   ON product_ingredients(product_id);
CREATE INDEX idx_product_ingredients_inventory ON product_ingredients(inventory_id);

-- RLS
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_product_ingredients"
  ON product_ingredients FOR ALL USING (true) WITH CHECK (true);

-- ============================================
--  ข้อมูลตัวอย่าง — ส่วนผสมเมนูกาแฟ
-- ============================================
INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 18
FROM products p, inventory i
WHERE p.name = 'อเมริกาโน่ร้อน' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'อเมริกาโน่ร้อน' AND i.name = 'ถ้วย M (ร้อน)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 18
FROM products p, inventory i
WHERE p.name = 'ลาเต้ร้อน' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 150
FROM products p, inventory i
WHERE p.name = 'ลาเต้ร้อน' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ลาเต้ร้อน' AND i.name = 'ถ้วย M (ร้อน)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 18
FROM products p, inventory i
WHERE p.name = 'คาปูชิโน่ร้อน' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 120
FROM products p, inventory i
WHERE p.name = 'คาปูชิโน่ร้อน' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'คาปูชิโน่ร้อน' AND i.name = 'ถ้วย M (ร้อน)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 18
FROM products p, inventory i
WHERE p.name = 'อเมริกาโน่เย็น' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'อเมริกาโน่เย็น' AND i.name = 'ถ้วย L (เย็น)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'อเมริกาโน่เย็น' AND i.name = 'หลอด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 18
FROM products p, inventory i
WHERE p.name = 'ลาเต้เย็น' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 150
FROM products p, inventory i
WHERE p.name = 'ลาเต้เย็น' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ลาเต้เย็น' AND i.name = 'ถ้วย L (เย็น)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ลาเต้เย็น' AND i.name = 'หลอด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 18
FROM products p, inventory i
WHERE p.name = 'มอคค่าเย็น' AND i.name = 'เมล็ดกาแฟ';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 120
FROM products p, inventory i
WHERE p.name = 'มอคค่าเย็น' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 15
FROM products p, inventory i
WHERE p.name = 'มอคค่าเย็น' AND i.name = 'ผงโกโก้';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'มอคค่าเย็น' AND i.name = 'ถ้วย L (เย็น)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 15
FROM products p, inventory i
WHERE p.name = 'ชาไทยร้อน' AND i.name = 'ชาไทย';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 20
FROM products p, inventory i
WHERE p.name = 'ชาไทยร้อน' AND i.name = 'น้ำตาล';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ชาไทยร้อน' AND i.name = 'ถ้วย M (ร้อน)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 15
FROM products p, inventory i
WHERE p.name = 'ชาไทยเย็น' AND i.name = 'ชาไทย';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 20
FROM products p, inventory i
WHERE p.name = 'ชาไทยเย็น' AND i.name = 'น้ำตาล';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 50
FROM products p, inventory i
WHERE p.name = 'ชาไทยเย็น' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'ชาไทยเย็น' AND i.name = 'ถ้วย L (เย็น)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 20
FROM products p, inventory i
WHERE p.name = 'โกโก้ร้อน' AND i.name = 'ผงโกโก้';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 150
FROM products p, inventory i
WHERE p.name = 'โกโก้ร้อน' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'โกโก้ร้อน' AND i.name = 'ถ้วย M (ร้อน)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 20
FROM products p, inventory i
WHERE p.name = 'โกโก้เย็น' AND i.name = 'ผงโกโก้';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 150
FROM products p, inventory i
WHERE p.name = 'โกโก้เย็น' AND i.name = 'นมสด';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'โกโก้เย็น' AND i.name = 'ถ้วย L (เย็น)';

INSERT INTO product_ingredients (product_id, inventory_id, quantity)
SELECT p.id, i.id, 1
FROM products p, inventory i
WHERE p.name = 'โกโก้เย็น' AND i.name = 'หลอด';
