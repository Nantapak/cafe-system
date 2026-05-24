-- =====================================================
-- Migration: เพิ่ม cashier tracking ในตาราง orders
-- รัน 1 ครั้งใน Supabase → SQL Editor
-- =====================================================

-- เพิ่ม column สำหรับบันทึกว่าใครสั่ง / ใครอัปเดต
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cashier_id      UUID,
  ADD COLUMN IF NOT EXISTS cashier_name    TEXT,
  ADD COLUMN IF NOT EXISTS handled_by_id   UUID,
  ADD COLUMN IF NOT EXISTS handled_by_name TEXT;

-- ตรวจสอบผลลัพธ์
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
