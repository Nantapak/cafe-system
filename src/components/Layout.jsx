import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar: ซ่อนบนมือถือ, icon-only บน tablet, full บน desktop */}
      <Sidebar />

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom nav: มือถือเท่านั้น */}
      <BottomNav />
    </div>
  )
}
