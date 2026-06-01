-- ══════════════════════════════════════════════════════
--  Daily Order Number Reset
--  คิวเริ่ม 1 ใหม่ทุกวัน + แยกข้อมูลตามวัน
--  รัน SQL Editor ใน Supabase Dashboard
-- ══════════════════════════════════════════════════════

-- 1. เพิ่ม column order_date (วันที่ของออเดอร์)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;

-- อัปเดต order_date ของข้อมูลเก่า
UPDATE orders
SET order_date = DATE(created_at AT TIME ZONE 'Asia/Bangkok')
WHERE order_date IS NULL;

-- 2. สร้าง function สำหรับ reset เลขคิวทุกวัน
CREATE OR REPLACE FUNCTION assign_daily_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- กำหนดวันที่
  NEW.order_date = CURRENT_DATE;

  -- หาเลขคิวถัดไปของวันนี้ (MAX + 1)
  SELECT COALESCE(MAX(order_number), 0) + 1
  INTO NEW.order_number
  FROM orders
  WHERE order_date = CURRENT_DATE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ลบ trigger เก่า (ถ้ามี) แล้วสร้างใหม่
DROP TRIGGER IF EXISTS trg_daily_order_number ON orders;

CREATE TRIGGER trg_daily_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION assign_daily_order_number();

-- 4. Index สำหรับ query ตามวัน (เร็วขึ้น)
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_date_status ON orders(order_date, status);
