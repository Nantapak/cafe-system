import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, ShoppingBag, AlertTriangle, Clock, RefreshCw } from 'lucide-react'

const COLORS = ['#a96318','#dc9a3a','#e8bc6c','#f3d9a8','#8a4b18']

function StatCard({ icon: Icon, label, value, sub, color = 'coffee', pulse = false }) {
  const colors = {
    coffee: 'bg-coffee-50 text-coffee-700 border-coffee-100',
    green:  'bg-green-50  text-green-700  border-green-100',
    blue:   'bg-blue-50   text-blue-700   border-blue-100',
    red:    'bg-red-50    text-red-700    border-red-100',
  }
  return (
    <div className={`card p-5 border ${colors[color]} relative overflow-hidden`}>
      {pulse && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}><Icon size={20} /></div>
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [loading,    setLoading]    = useState(true)
  const [live,       setLive]       = useState(false)
  const [syncing,    setSyncing]    = useState(false)

  /* ── Live stats (refresh ทุกครั้งที่มี order/inventory เปลี่ยน) ── */
  const [todayRevenue,  setTodayRevenue]  = useState(0)
  const [todayCount,    setTodayCount]    = useState(0)
  const [monthRevenue,  setMonthRevenue]  = useState(0)
  const [pendingCount,  setPendingCount]  = useState(0)
  const [recentOrders,  setRecentOrders]  = useState([])
  const [lowStock,      setLowStock]      = useState([])

  /* ── Static (โหลดครั้งเดียวตอนเปิดหน้า) ── */
  const [salesChart, setSalesChart] = useState([])
  const [topItems,   setTopItems]   = useState([])

  /* ── Fetch live stats — 5 parallel queries ── */
  const fetchLive = useCallback(async ({ silent = false } = {}) => {
    if (silent) setSyncing(true)

    const now        = new Date()
    const today      = now.toISOString().slice(0, 10)
    const thirtyAgo  = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 29)
    const monthStart = thirtyAgo.toISOString().slice(0, 10)

    const [
      { data: todayOrds },
      { data: monthOrds },
      { count: pending },
      { data: recent },
      { data: inv },
    ] = await Promise.all([
      supabase.from('orders').select('total')
        .gte('created_at', today + 'T00:00:00').neq('status', 'cancelled'),
      supabase.from('orders').select('total')
        .gte('created_at', monthStart + 'T00:00:00').neq('status', 'cancelled'),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'preparing']),
      supabase.from('orders').select('order_number, total, status, created_at, cashier_name')
        .order('created_at', { ascending: false }).limit(6),
      supabase.from('inventory').select('id, name, unit, quantity, min_quantity'),
    ])

    setTodayRevenue(todayOrds?.reduce((s, o) => s + Number(o.total), 0) || 0)
    setTodayCount(todayOrds?.length || 0)
    setMonthRevenue(monthOrds?.reduce((s, o) => s + Number(o.total), 0) || 0)
    setPendingCount(pending || 0)
    setRecentOrders(recent || [])
    setLowStock((inv || []).filter(i => Number(i.quantity) <= Number(i.min_quantity)))

    if (silent) setSyncing(false)
  }, [])

  /* ── Fetch charts — โหลดครั้งเดียว (ข้อมูลประวัติ ไม่เปลี่ยน realtime) ── */
  const fetchCharts = useCallback(async () => {
    const now = new Date()

    /* กราฟ 7 วัน — query เดียว แล้ว group client-side */
    const sevenAgo = new Date(now)
    sevenAgo.setDate(sevenAgo.getDate() - 6)
    sevenAgo.setHours(0, 0, 0, 0)

    const { data: weekOrds } = await supabase
      .from('orders').select('total, created_at')
      .gte('created_at', sevenAgo.toISOString()).neq('status', 'cancelled')

    const dayMap = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      dayMap[ds] = {
        date: d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }),
        ยอดขาย: 0, จำนวน: 0,
      }
    }
    weekOrds?.forEach(o => {
      const ds = o.created_at.slice(0, 10)
      if (dayMap[ds]) { dayMap[ds].ยอดขาย += Number(o.total); dayMap[ds].จำนวน += 1 }
    })
    setSalesChart(Object.values(dayMap))

    /* สินค้าขายดี */
    const { data: items } = await supabase
      .from('order_items')
      .select('name, quantity, price, orders!inner(status)')
      .neq('orders.status', 'cancelled')
      .limit(500)
    const itemMap = {}
    items?.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 }
      itemMap[i.name].qty     += i.quantity
      itemMap[i.name].revenue += i.price * i.quantity
    })
    setTopItems(Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5))
  }, [])

  /* ── Initial load ── */
  useEffect(() => {
    setLoading(true)
    Promise.all([fetchLive(), fetchCharts()]).then(() => setLoading(false))
  }, [fetchLive, fetchCharts])

  /* ── Realtime subscription + polling fallback ── */
  useEffect(() => {
    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
        () => { fetchLive({ silent: true }); fetchCharts() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' },
        () => fetchLive({ silent: true }))
      .subscribe(status => setLive(status === 'SUBSCRIBED'))

    /* polling ทุก 30 วินาที กรณี realtime ไม่ทำงาน */
    const timer = setInterval(() => {
      fetchLive({ silent: true })
      fetchCharts()
    }, 30000)

    return () => {
      supabase.removeChannel(ch)
      clearInterval(timer)
    }
  }, [fetchLive, fetchCharts])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-coffee-600 text-lg">กำลังโหลดข้อมูล... ☕</div>
  )

  const STATUS_BADGE = {
    pending: 'badge-pending', preparing: 'badge-preparing',
    ready: 'badge-ready', completed: 'badge-completed', cancelled: 'badge-cancelled',
  }
  const STATUS_TH = {
    pending: 'รอ', preparing: 'ทำอยู่', ready: 'พร้อม', completed: 'เสร็จ', cancelled: 'ยกเลิก',
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">แดชบอร์ด</h1>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600
                             bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400
                             bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              กำลังเชื่อมต่อ...
            </span>
          )}
        </div>
        <button
          onClick={() => { fetchLive({ silent: true }); fetchCharts() }}
          className="btn-secondary flex items-center gap-2 text-sm py-1.5"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{syncing ? 'กำลังอัปเดต...' : 'รีเฟรช'}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp}    label="ยอดขายวันนี้"   value={`฿${todayRevenue.toLocaleString()}`}  sub={`${todayCount} ออเดอร์`}           color="coffee" pulse={live} />
        <StatCard icon={ShoppingBag}   label="ยอดขาย 30 วัน" value={`฿${monthRevenue.toLocaleString()}`}  sub="รวมทุกออเดอร์"                      color="green"  pulse={live} />
        <StatCard icon={Clock}         label="รอดำเนินการ"     value={pendingCount}                         sub="ออเดอร์ที่ยังค้างอยู่"               color="blue"   pulse={live} />
        <StatCard icon={AlertTriangle} label="สต็อกใกล้หมด"   value={lowStock.length}                      sub={lowStock.length > 0 ? 'ต้องเติมด่วน!' : 'ปกติ'} color={lowStock.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Low stock alert banner */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-red-700 text-sm">วัตถุดิบที่ต้องเติมด่วน</h2>
            <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{lowStock.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {lowStock.map(i => (
              <div key={i.id} className="bg-white border border-red-100 rounded-xl px-3 py-2">
                <p className="font-semibold text-red-700 text-sm truncate">{i.name}</p>
                <p className="text-red-400 text-xs mt-0.5">
                  เหลือ <strong>{Number(i.quantity).toLocaleString()}</strong> / ขั้นต่ำ {Number(i.min_quantity).toLocaleString()} {i.unit}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-700 mb-4">ยอดขาย 7 วันล่าสุด</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a96318" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a96318" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`฿${v.toLocaleString()}`, 'ยอดขาย']} />
              <Area type="monotone" dataKey="ยอดขาย" stroke="#a96318" fill="url(#colorRev)" strokeWidth={2} dot={{ r: 3, fill: '#a96318' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-700 mb-4">สินค้าขายดี</h2>
          {topItems.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={topItems} dataKey="qty" nameKey="name" cx="50%" cy="50%" outerRadius={70} labelLine={false}>
                  {topItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                <Tooltip formatter={(v, n) => [v + ' แก้ว', n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bar chart + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-700 mb-4">จำนวนออเดอร์ / วัน</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={salesChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip />
              <Bar dataKey="จำนวน" fill="#dc9a3a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">ออเดอร์ล่าสุด</h2>
            {syncing && <RefreshCw size={13} className="text-gray-400 animate-spin" />}
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">ยังไม่มีออเดอร์</p>
          ) : (
            <div className="space-y-1.5">
              {recentOrders.map(o => (
                <div key={o.order_number}
                  className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-bold text-gray-500 w-10 shrink-0">#{o.order_number}</span>
                  <span className={STATUS_BADGE[o.status] + ' text-xs shrink-0'}>{STATUS_TH[o.status]}</span>
                  {o.cashier_name && (
                    <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-[80px]">{o.cashier_name}</span>
                  )}
                  <span className="flex-1 text-gray-400 text-xs">
                    {new Date(o.created_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="font-bold text-coffee-700 shrink-0">฿{Number(o.total).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
