/**
 * Supabase Admin Client — ใช้ Service Role Key
 * ใช้สำหรับ: สร้าง / แก้ไข / ลบ user (admin only)
 *
 * ⚠️  ต้องตั้ง VITE_SUPABASE_SERVICE_KEY ใน:
 *      - .env.local (local dev)
 *      - Vercel Environment Variables (production)
 *      อย่านำ Service Key ขึ้น public repository
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_SERVICE_KEY

// สร้าง client แบบ lazy เพื่อป้องกัน crash ถ้า key ยังไม่ได้ตั้ง
let _adminClient = null

function getAdminClient() {
  if (!url || !key) {
    console.error('❌ VITE_SUPABASE_SERVICE_KEY ยังไม่ได้ตั้งค่า — ไปที่ Vercel → Environment Variables')
    return null
  }
  if (!_adminClient) {
    _adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _adminClient
}

// Proxy object — เรียกใช้งานเหมือน supabaseAdmin.auth.admin.listUsers() ปกติ
// แต่จะ throw error ที่อ่านง่ายถ้า key ไม่ถูกตั้ง
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_, prop) {
      const client = getAdminClient()
      if (!client) {
        throw new Error('Service Key ยังไม่ได้ตั้งค่า — เพิ่ม VITE_SUPABASE_SERVICE_KEY ใน Vercel')
      }
      const value = client[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)
