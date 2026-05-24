import { Outlet } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

const ROLE_LABELS = {
  admin:   'ผู้ดูแลระบบ',
  cashier: 'แคชเชียร์',
  barista: 'บาริสต้า',
}

export default function Layout() {
  const { user, role, signOut } = useAuth()

  const displayName = user?.user_metadata?.name
    || user?.user_metadata?.username
    || 'ผู้ใช้'

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

      {/* ── Mobile top bar ── */}
      <header className="md:hidden flex items-center justify-between
                         bg-coffee-800 text-white px-4 py-2.5 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {import.meta.env.VITE_SHOP_EMOJI || '☕'}
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">
              {import.meta.env.VITE_SHOP_NAME || 'ร้านกาแฟ'}
            </p>
            <p className="text-[10px] text-coffee-300 leading-none">
              {import.meta.env.VITE_SHOP_TAGLINE || 'Cafe Management'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ชื่อ + role */}
          <div className="text-right">
            <p className="text-xs font-semibold leading-tight">{displayName}</p>
            <p className="text-[10px] text-coffee-300 leading-none">
              {ROLE_LABELS[role] || role}
            </p>
          </div>
          {/* Logout */}
          <button
            onClick={signOut}
            title="ออกจากระบบ"
            className="ml-1 p-2 rounded-lg bg-coffee-700 hover:bg-red-500/80
                       active:bg-red-600 transition-colors"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: ซ่อนบนมือถือ, icon-only บน tablet, full บน desktop */}
        <Sidebar />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav: มือถือเท่านั้น */}
      <BottomNav />
    </div>
  )
}
