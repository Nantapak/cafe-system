-- =====================================================
-- สร้าง Admin User คนแรก
-- (หลังจากนี้ใช้หน้า "จัดการพนักงาน" ในระบบแทน)
-- =====================================================
-- ระบบใช้ username ในการ Login (ไม่ใช้ email)
-- email ที่เก็บใน Supabase จริง = {username}@cafe.local
-- =====================================================
-- Role ที่ใช้ในระบบ:
--   admin   → เข้าได้ทุกหน้า (dashboard, pos, orders, menu, inventory, staff)
--   cashier → เข้าได้ pos, orders
--   barista → เข้าได้ orders เท่านั้น
-- =====================================================

-- สร้าง Admin คนแรก (username: admin  /  password: Admin1234!)
SELECT auth.create_user(
  uid               := gen_random_uuid(),
  email             := 'admin@cafe.local',
  password          := 'admin1234',
  email_confirm     := true,
  raw_user_meta_data := '{"role": "admin", "name": "ผู้จัดการ", "username": "admin"}'::jsonb
);

-- =====================================================
-- หลังจากได้ Admin แล้ว → เข้าระบบด้วย
--   username : admin
--   password : admin1234
-- แล้วไปสร้างพนักงานคนอื่นที่เมนู "จัดการพนักงาน"
-- =====================================================

-- ─── สร้าง User เพิ่มเติมทาง SQL (ถ้าต้องการ) ───
-- SELECT auth.create_user(
--   uid               := gen_random_uuid(),
--   email             := 'cashier01@cafe.local',
--   password          := 'Password1234!',
--   email_confirm     := true,
--   raw_user_meta_data := '{"role": "cashier", "name": "น้องมิ้ว", "username": "cashier01"}'::jsonb
-- );

-- SELECT auth.create_user(
--   uid               := gen_random_uuid(),
--   email             := 'barista01@cafe.local',
--   password          := 'Password1234!',
--   email_confirm     := true,
--   raw_user_meta_data := '{"role": "barista", "name": "น้องนุ่น", "username": "barista01"}'::jsonb
-- );

-- ─── แก้ไข Role / ชื่อ ของ User ที่มีอยู่ ───
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data
--   || '{"role": "cashier", "name": "ชื่อใหม่", "username": "username"}'::jsonb
-- WHERE email = 'username@cafe.local';

-- ─── ดู User ทั้งหมดพร้อม Role ───
SELECT
  raw_user_meta_data->>'username' AS username,
  raw_user_meta_data->>'name'     AS display_name,
  raw_user_meta_data->>'role'     AS role,
  created_at
FROM auth.users
ORDER BY created_at;

-- ─── ลบ User (กรณีฉุกเฉิน) ───
-- DELETE FROM auth.users WHERE email = 'username@cafe.local';
