import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import ShopLogo from './ShopLogo'

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
    <div className="flex flex-col h-screen overflow-hidden bg-coffee-50">

      {/* ── Mobile top bar ── */}
      <header className="md:hidden flex items-center justify-between
                         bg-coffee-800 text-white px-4 py-2.5 shrink-0 z-30">
        <ShopLogo iconSize={26} showText={true} invert={true}
          textColor="text-white" subColor="text-coffee-300" />

        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <p className="text-xs font-semibold leading-tight">{displayName}</p>
            <p className="text-[10px] text-coffee-300 leading-none">
              {ROLE_LABELS[role] || role}
            </p>
          </div>
          <button
            onClick={signOut}
            title="ออกจากระบบ"
            className="p-2 rounded-lg bg-coffee-700 hover:bg-red-500/80
                       active:bg-red-600 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
