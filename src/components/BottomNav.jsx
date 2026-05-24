import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, ClipboardList, Coffee, Package, BarChart2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const ALL_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด', roles: ['admin'] },
  { to: '/pos',       icon: ShoppingCart,    label: 'POS',       roles: ['admin', 'cashier'] },
  { to: '/orders',    icon: ClipboardList,   label: 'ออเดอร์',   roles: ['admin', 'cashier', 'barista'] },
  { to: '/menu',      icon: Coffee,          label: 'เมนู',      roles: ['admin'] },
  { to: '/inventory', icon: Package,         label: 'สต็อก',     roles: ['admin'], lowStock: true },
  { to: '/reports',   icon: BarChart2,       label: 'รายงาน',    roles: ['admin'] },
]

export default function BottomNav() {
  const { role } = useAuth()
  const navItems = ALL_NAV.filter(n => n.roles.includes(role))
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    if (role !== 'admin') return
    const fetch = async () => {
      const { data } = await supabase.from('inventory').select('quantity, min_quantity')
      setLowStockCount((data || []).filter(i => Number(i.quantity) <= Number(i.min_quantity)).length)
    }
    fetch()
    const ch = supabase.channel('bottomnav-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [role])

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {navItems.map(({ to, icon: Icon, label, lowStock }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center pt-2 pb-1.5 gap-0.5 text-xs font-medium transition-colors
               ${isActive ? 'text-coffee-600' : 'text-gray-400 active:text-gray-600'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative p-1 rounded-xl transition-colors ${isActive ? 'bg-coffee-50' : ''}`}>
                  <Icon size={22} />
                  {lowStock && lowStockCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full
                                     text-[8px] font-bold text-white flex items-center justify-center">
                      {lowStockCount > 9 ? '9+' : lowStockCount}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
