-- =====================================================
-- วิธีสร้าง User + กำหนด Role ใน Supabase
-- =====================================================
-- Role ที่ใช้ในระบบ:
--   admin   → เข้าได้ทุกหน้า (dashboard, pos, orders, menu, inventory)
--   cashier → เข้าได้ pos, orders
--   barista → เข้าได้ orders เท่านั้น
-- =====================================================

-- วิธีที่ 1: สร้าง User ผ่าน SQL (แนะนำ)
-- รันใน Supabase SQL Editor ทีละคำสั่ง

-- สร้าง Admin
SELECT auth.create_user(
  uid        := gen_random_uuid(),
  email      := 'admin@mycafe.com',
  password   := 'Admin1234!',
  email_confirm := true,
  raw_user_meta_data := '{"role": "admin", "name": "ผู้จัดการ"}'::jsonb
);

-- สร้าง Cashier
SELECT auth.create_user(
  uid        := gen_random_uuid(),
  email      := 'cashier@mycafe.com',
  password   := 'Cashier1234!',
  email_confirm := true,
  raw_user_meta_data := '{"role": "cashier", "name": "พนักงานแคชเชียร์"}'::jsonb
);

-- สร้าง Barista
SELECT auth.create_user(
  uid        := gen_random_uuid(),
  email      := 'barista@mycafe.com',
  password   := 'Barista1234!',
  email_confirm := true,
  raw_user_meta_data := '{"role": "barista", "name": "บาริสต้า"}'::jsonb
);

-- =====================================================
-- แก้ไข Role ของ User ที่มีอยู่แล้ว
-- (เปลี่ยน email เป็น email จริง)
-- =====================================================
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "cashier"}'::jsonb
WHERE email = 'cashier@mycafe.com';

-- =====================================================
-- ดู User ทั้งหมดพร้อม Role
-- =====================================================
SELECT
  email,
  raw_user_meta_data->>'role' AS role,
  raw_user_meta_data->>'name' AS name,
  created_at
FROM auth.users
ORDER BY created_at;

-- =====================================================
-- วิธีที่ 2: สร้าง User ผ่าน Supabase Dashboard
-- Authentication → Users → "Add user" button
-- แล้วใส่ email + password
-- จากนั้นรัน SQL นี้เพื่อตั้ง role:
-- =====================================================
-- UPDATE auth.users
-- SET raw_user_meta_data = '{"role": "cashier"}'::jsonb
-- WHERE email = 'your-email@example.com';
