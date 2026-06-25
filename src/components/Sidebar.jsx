import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, ClipboardList,
  Coffee, Package, Users, LogOut, BarChart2, Star,
  LogIn, UserCircle2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getCashierName } from '../lib/cashierStore'
import ShopLogo from './ShopLogo'

/* เมนูสาธารณะ — ไม่ต้อง login */
const PUBLIC_NAV = [
  { to: '/pos',       icon: ShoppingCart,  label: 'POS / แคชเชียร์' },
  { to: '/orders',    icon: ClipboardList, label: 'ออเดอร์' },
  { to: '/customers', icon: Star,          label: 'สมาชิก' },
]

/* เมนู admin เพิ่มเติม */
const ADMIN_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด' },
  { to: '/menu',      icon: Coffee,          label: 'จัดการเมนู' },
  { to: '/inventory', icon: Package,         label: 'สต็อกวัตถุดิบ', lowStock: true },
  { to: '/staff',     icon: Users,           label: 'จัดการพนักงาน' },
  { to: '/reports',   icon: BarChart2,       label: 'รายงานยอดขาย' },
]

export default function Sidebar() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user && role === 'admin'

  const navItems = isAdmin ? [...PUBLIC_NAV, ...ADMIN_NAV] : PUBLIC_NAV

  const displayName = isAdmin
    ? (user.user_metadata?.name || user.user_metadata?.username || 'Admin')
    : (getCashierName() || 'แคชเชียร์')

  /* ── Low stock count (admin only) ── */
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return

    const fetchLowStock = async () => {
      const { data } = await supabase.from('inventory').select('id, quantity, min_quantity')
      setLowStockCount(
        (data || []).filter(i => Number(i.quantity) <= Number(i.min_quantity)).length
      )
    }

    fetchLowStock()

    const ch = supabase.channel('sidebar-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchLowStock)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [isAdmin])

  return (
    <aside className="hidden md:flex flex-col bg-coffee-800 text-white shadow-xl shrink-0 w-16 lg:w-60 transition-[width] duration-200">

      {/* Logo */}
      <div className="flex items-center justify-center lg:justify-start px-3 lg:px-5 py-5 border-b border-coffee-700 min-h-[72px]">
        <div className="lg:hidden">
          <ShopLogo iconSize={30} showText={false} invert={true} />
        </div>
        <div className="hidden lg:block">
          <ShopLogo iconSize={30} showText={true} invert={true}
            textColor="text-white" subColor="text-coffee-300" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, lowStock }) => (
          <NavLink key={to} to={to} title={label}
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
                               min-w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white px-1">
                {lowStockCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 lg:px-4 py-4 border-t border-coffee-700">
        {isAdmin ? (
          <>
            <div className="hidden lg:block mb-3">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <span className="inline-block mt-1 text-xs bg-coffee-600 text-coffee-100 rounded-full px-2 py-0.5">
                ผู้ดูแลระบบ
              </span>
            </div>
            <button onClick={signOut} title="ออกจากระบบ"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
                         text-coffee-300 hover:bg-red-500/20 hover:text-red-300
                         transition-colors text-sm">
              <LogOut size={16} className="shrink-0" />
              <span className="hidden lg:block">ออกจากระบบ</span>
            </button>
          </>
        ) : (
          <>
            {/* แสดงชื่อแคชเชียร์ */}
            <div className="hidden lg:flex items-center gap-2 mb-3 px-1">
              <UserCircle2 size={18} className="text-coffee-400 shrink-0" />
              <p className="text-sm text-coffee-300 truncate">{displayName}</p>
            </div>
            {/* ปุ่ม Admin Login */}
            <button onClick={() => navigate('/login')} title="เข้าสู่ระบบผู้ดูแล"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
                         text-coffee-400 hover:bg-coffee-700 hover:text-coffee-200
                         transition-colors text-sm">
              <LogIn size={16} className="shrink-0" />
              <span className="hidden lg:block">เข้าสู่ระบบ Admin</span>
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
