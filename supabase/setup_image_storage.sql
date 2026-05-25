-- ══════════════════════════════════════════════════════
--  สร้าง Supabase Storage Bucket สำหรับรูปภาพเมนู
--  วิ่งใน Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. สร้าง bucket ชื่อ "menu-images" (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: ทุกคนอ่านรูปได้ (public read)
CREATE POLICY "Public read menu images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'menu-images' );

-- 3. Policy: ต้อง login ถึงจะ upload ได้
CREATE POLICY "Authenticated upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'menu-images' );

-- 4. Policy: ต้อง login ถึงจะลบได้
CREATE POLICY "Authenticated delete menu images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'menu-images' );

-- 5. เพิ่ม column image_url ในตาราง products (ถ้ายังไม่มี)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT;
