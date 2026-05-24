import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_DEFAULT } from '../contexts/AuthContext'
import { Coffee, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await signIn(email.trim(), password)
      if (error) throw error
      const userRole = data.user?.user_metadata?.role || 'cashier'
      navigate(ROLE_DEFAULT[userRole] || '/pos', { replace: true })
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  const SHOP_NAME    = import.meta.env.VITE_SHOP_NAME    || 'ร้านกาแฟ'
  const SHOP_TAGLINE = import.meta.env.VITE_SHOP_TAGLINE || 'Cafe Management'
  const SHOP_EMOJI   = import.meta.env.VITE_SHOP_EMOJI   || '☕'

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-900 via-coffee-800 to-coffee-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-3xl mb-4 shadow-xl border border-white/20">
            <span className="text-4xl">{SHOP_EMOJI}</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{SHOP_NAME}</h1>
          <p className="text-coffee-300 text-sm mt-1">{SHOP_TAGLINE}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Coffee size={20} className="text-coffee-600" />
            เข้าสู่ระบบ
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input w-full"
                placeholder="email@example.com"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-coffee-400 mt-6">
          ติดต่อผู้ดูแลระบบหากลืมรหัสผ่าน
        </p>
      </div>
    </div>
  )
}
