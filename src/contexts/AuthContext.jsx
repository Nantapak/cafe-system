import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

/* ── Session config ── */
const SESSION_KEY = 'cafe_login_at'

const ROLE_DEFAULT = {
  admin:   '/dashboard',
  cashier: '/pos',
  barista: '/orders',
}

export { ROLE_DEFAULT }

/** ตรวจว่า login เป็นวันเดิมกับวันนี้ไหม
 *  ถ้า login เมื่อวาน (หรือก่อนหน้า) → expired → ต้อง login ใหม่ */
function isSessionExpired() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return false   // ไม่มี timestamp = ไม่บังคับ (backward compat)
  const loginDate = new Date(parseInt(raw, 10)).toDateString()
  const today     = new Date().toDateString()
  return loginDate !== today
}

export function AuthProvider({ children }) {
  // undefined = กำลังโหลด, null = ไม่ได้ login
  const [user, setUser] = useState(undefined)
  const [role, setRole] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && isSessionExpired()) {
        // login คนละวัน → force logout อัตโนมัติ
        localStorage.removeItem(SESSION_KEY)
        await supabase.auth.signOut()
        setUser(null)
        setRole(null)
        return
      }
      setUser(session?.user ?? null)
      setRole(session?.user?.user_metadata?.role ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setRole(session?.user?.user_metadata?.role ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  /* ── Sign in: บันทึกเวลา login ── */
  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (!result.error) {
      localStorage.setItem(SESSION_KEY, Date.now().toString())
    }
    return result
  }

  /* ── Sign out: ล้าง timestamp ── */
  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY)
    return supabase.auth.signOut()
  }

  /* ── คืนเวลาที่ session หมดอายุ (เที่ยงคืนของวันที่ login) ── */
  const sessionExpiresAt = () => {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const d = new Date(parseInt(raw, 10))
    d.setHours(23, 59, 59, 999)   // สิ้นสุดวันที่ login
    return d
  }

  /* ── คืนชั่วโมงที่เหลือในวันนี้ ── */
  const sessionDaysLeft = () => {
    const exp = sessionExpiresAt()
    if (!exp) return null
    const ms = exp.getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (60 * 60 * 1000)))  // คืนเป็นชั่วโมง
  }

  return (
    <AuthContext.Provider value={{ user, role, signIn, signOut, sessionExpiresAt, sessionDaysLeft }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
