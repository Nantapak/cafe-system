/**
 * Supabase Admin Client — ใช้ Service Role Key
 * ใช้สำหรับ: สร้าง / แก้ไข / ลบ user (admin only)
 *
 * ⚠️  อย่านำ Service Key ขึ้น public repository
 *      เพิ่ม VITE_SUPABASE_SERVICE_KEY ใน .env.local และ Vercel Environment Variables
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export { supabaseAdmin }
