import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_DEFAULT } from '../contexts/AuthContext'
import { Eye, EyeOff, User } from 'lucide-react'
import ShopLogo from '../components/ShopLogo'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const email = `${username.trim().toLowerCase()}@cafe.local`
      const { data, error } = await signIn(email, password)
      if (error) throw error
      const userRole = data.user?.user_metadata?.role || 'cashier'
      navigate(ROLE_DEFAULT[userRole] || '/pos', { replace: true })
    } catch {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-coffee-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xs">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5">
            <ShopLogo
              color="#3A2A1C"
              iconSize={56}
              showText={false}
            />
          </div>
          <p className="text-3xl font-black text-coffee-800 tracking-tight leading-none">
            5th cup
          </p>
          <p className="text-sm text-coffee-400 mt-1 tracking-widest font-light">
            FIFTH CUP
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-coffee-100 p-7">
          <p className="text-xs font-semibold text-coffee-400 uppercase tracking-widest mb-5">
            เข้าสู่ระบบ
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">ชื่อผู้ใช้</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <User size={14} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="input pl-9"
                  placeholder="username"
                  required autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm mt-1"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-coffee-300 mt-6">
          ติดต่อผู้ดูแลระบบหากลืมรหัสผ่าน
        </p>
      </div>
    </div>
  )
}
