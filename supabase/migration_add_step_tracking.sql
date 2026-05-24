-- =====================================================
-- Migration: เพิ่ม per-step tracking ในตาราง orders
-- บันทึกว่าใครทำอะไรในแต่ละขั้นตอน
-- รัน 1 ครั้งใน Supabase → SQL Editor
-- =====================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prepared_by_name   TEXT,   -- ใครกด "เริ่มทำ"
  ADD COLUMN IF NOT EXISTS ready_by_name      TEXT,   -- ใครกด "พร้อมเสิร์ฟ"
  ADD COLUMN IF NOT EXISTS completed_by_name  TEXT,   -- ใครกด "จัดส่งแล้ว"
  ADD COLUMN IF NOT EXISTS cancelled_by_name  TEXT,   -- ใครกด "ยกเลิก"
  ADD COLUMN IF NOT EXISTS prepared_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at           TIMESTAMPTZ;

-- ตรวจสอบผลลัพธ์
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
