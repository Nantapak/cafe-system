import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, ClipboardList,
  Coffee, Package, LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ALL_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด',       roles: ['admin'] },
  { to: '/pos',       icon: ShoppingCart,    label: 'POS / แคชเชียร์', roles: ['admin', 'cashier'] },
  { to: '/orders',    icon: ClipboardList,   label: 'ออเดอร์',          roles: ['admin', 'cashier', 'barista'] },
  { to: '/menu',      icon: Coffee,          label: 'จัดการเมนู',       roles: ['admin'] },
  { to: '/inventory', icon: Package,         label: 'สต็อกวัตถุดิบ',    roles: ['admin'] },
]

const ROLE_LABELS = {
  admin:   'ผู้ดูแลระบบ',
  cashier: 'แคชเชียร์',
  barista: 'บาริสต้า',
}

export default function Sidebar() {
  const { user, role, signOut } = useAuth()
  const navItems = ALL_NAV.filter(n => n.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col bg-coffee-800 text-white shadow-xl shrink-0 w-16 lg:w-60 transition-[width] duration-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 lg:px-5 py-5 border-b border-coffee-700 min-h-[72px]">
        <span className="text-2xl shrink-0">
          {import.meta.env.VITE_SHOP_EMOJI || '☕'}
        </span>
        <div className="hidden lg:block overflow-hidden">
          <p className="font-bold text-base leading-tight truncate">
            {import.meta.env.VITE_SHOP_NAME || 'ร้านกาแฟ'}
          </p>
          <p className="text-coffee-300 text-xs truncate">
            {import.meta.env.VITE_SHOP_TAGLINE || 'Cafe Management'}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-coffee-600 text-white'
                 : 'text-coffee-200 hover:bg-coffee-700 hover:text-white'}`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="px-2 lg:px-4 py-4 border-t border-coffee-700">
        <div className="hidden lg:block mb-3">
          <p className="text-xs text-coffee-200 font-medium truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-coffee-600 text-coffee-100 rounded-full px-2 py-0.5">
            {ROLE_LABELS[role] || role}
          </span>
        </div>
        <button
          onClick={signOut}
          title="ออกจากระบบ"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
                     text-coffee-300 hover:bg-red-500/20 hover:text-red-300
                     transition-colors text-sm"
        >
          <LogOut size={16} className="shrink-0" />
          <span className="hidden lg:block">ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  )
}
