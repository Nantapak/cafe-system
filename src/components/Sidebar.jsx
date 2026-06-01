import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, ClipboardList,
  Coffee, Package, Users, LogOut, BarChart2, Star,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import ShopLogo from './ShopLogo'

const ALL_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด',       roles: ['admin'] },
  { to: '/pos',       icon: ShoppingCart,    label: 'POS / แคชเชียร์', roles: ['admin', 'cashier'] },
  { to: '/orders',    icon: ClipboardList,   label: 'ออเดอร์',          roles: ['admin', 'cashier', 'barista'] },
  { to: '/customers', icon: Star,            label: 'สมาชิก',           roles: ['admin', 'cashier'] },
  { to: '/menu',      icon: Coffee,          label: 'จัดการเมนู',       roles: ['admin'] },
  { to: '/inventory', icon: Package,         label: 'สต็อกวัตถุดิบ',    roles: ['admin'], lowStock: true },
  { to: '/staff',     icon: Users,           label: 'จัดการพนักงาน',    roles: ['admin'] },
  { to: '/reports',   icon: BarChart2,       label: 'รายงานยอดขาย',     roles: ['admin'] },
]

const ROLE_LABELS = {
  admin:   'ผู้ดูแลระบบ',
  cashier: 'แคชเชียร์',
  barista: 'บาริสต้า',
}

export default function Sidebar() {
  const { user, role, signOut } = useAuth()
  const navItems = ALL_NAV.filter(n => n.roles.includes(role))

  const displayName = user?.user_metadata?.name || user?.user_metadata?.username || '-'
  const username    = user?.user_metadata?.username || user?.email?.replace('@cafe.local', '')

  /* ── Low stock count ── */
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    if (role !== 'admin') return

    const fetchLowStock = async () => {
      const { data } = await supabase
        .from('inventory')
        .select('id, quantity, min_quantity')
      setLowStockCount(
        (data || []).filter(i => Number(i.quantity) <= Number(i.min_quantity)).length
      )
    }

    fetchLowStock()

    const ch = supabase.channel('sidebar-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchLowStock)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [role])

  return (
    <aside className="hidden md:flex flex-col bg-coffee-800 text-white shadow-xl shrink-0 w-16 lg:w-60 transition-[width] duration-200">
      <div className="flex items-center justify-center lg:justify-start px-3 lg:px-5 py-5 border-b border-coffee-700 min-h-[72px]">
        {/* icon-only บนหน้าจอแคบ */}
        <div className="lg:hidden">
          <ShopLogo iconSize={30} showText={false} invert={true} />
        </div>
        {/* full logo บน desktop */}
        <div className="hidden lg:block">
          <ShopLogo iconSize={30} showText={true} invert={true}
            textColor="text-white" subColor="text-coffee-300" />
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, lowStock }) => (
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
            <div className="relative shrink-0">
              <Icon size={18} />
              {lowStock && lowStockCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full
                                 text-[9px] font-bold text-white flex items-center justify-center">
                  {lowStockCount > 9 ? '9+' : lowStockCount}
                </span>
              )}
            </div>
            <span className="hidden lg:block">{label}</span>
            {lowStock && lowStockCount > 0 && (
              <span className="hidden lg:flex ml-auto items-center justify-center
                               min-w-5 h-5 bg-red-500 rounded-full
                               text-[10px] font-bold text-white px-1">
                {lowStockCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 lg:px-4 py-4 border-t border-coffee-700">
        <div className="hidden lg:block mb-3">
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          <p className="text-xs text-coffee-400 truncate">@{username}</p>
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
