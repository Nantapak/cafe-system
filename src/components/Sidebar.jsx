import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Coffee,
  Package,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด' },
  { to: '/pos',       icon: ShoppingCart,    label: 'POS / แคชเชียร์' },
  { to: '/orders',    icon: ClipboardList,   label: 'ออเดอร์' },
  { to: '/menu',      icon: Coffee,          label: 'จัดการเมนู' },
  { to: '/inventory', icon: Package,         label: 'สต็อกวัตถุดิบ' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 bg-coffee-800 text-white flex flex-col shadow-xl shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-coffee-700">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{import.meta.env.VITE_SHOP_EMOJI || '☕'}</span>
          <div>
            <p className="font-bold text-lg leading-tight">
              {import.meta.env.VITE_SHOP_NAME || 'ร้านกาแฟ'}
            </p>
            <p className="text-coffee-300 text-xs">
              {import.meta.env.VITE_SHOP_TAGLINE || 'Cafe Management'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-coffee-600 text-white'
                 : 'text-coffee-200 hover:bg-coffee-700 hover:text-white'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-coffee-700 text-coffee-400 text-xs text-center">
        v1.0.0 · ระบบร้านกาแฟ
      </div>
    </aside>
  )
}
