import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, ShoppingBag, AlertTriangle, Clock } from 'lucide-react'

const COLORS = ['#a96318','#dc9a3a','#e8bc6c','#f3d9a8','#8a4b18']

function StatCard({ icon: Icon, label, value, sub, color = 'coffee' }) {
  const colors = {
    coffee: 'bg-coffee-50 text-coffee-700 border-coffee-100',
    green:  'bg-green-50  text-green-700  border-green-100',
    blue:   'bg-blue-50   text-blue-700   border-blue-100',
    red:    'bg-red-50    text-red-700    border-red-100',
  }
  return (
    <div className={`card p-5 border ${colors[color]}`}>
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
  const [stats,      setStats]      = useState(null)
  const [salesChart, setSalesChart] = useState([])
  const [topItems,   setTopItems]   = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [lowStock,   setLowStock]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const now   = new Date()
      const today = now.toISOString().slice(0, 10)

      // ยอดวันนี้
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total, status')
        .gte('created_at', today + 'T00:00:00')
        .neq('status', 'cancelled')

      const todayRevenue = todayOrders?.reduce((s, o) => s + Number(o.total), 0) || 0
      const todayCount   = todayOrders?.length || 0

      // ยอดเดือนนี้
      const monthStart = today.slice(0, 7) + '-01'
      const { data: monthOrders } = await supabase
        .from('orders').select('total').gte('created_at', monthStart + 'T00:00:00').neq('status', 'cancelled')
      const monthRevenue = monthOrders?.reduce((s, o) => s + Number(o.total), 0) || 0

      // รอดำเนินการ
      const { count: pendingCount } = await supabase
        .from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending','preparing'])

      // กราฟ 7 วัน
      const chartData = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        const { data: dayOrd } = await supabase
          .from('orders').select('total')
          .gte('created_at', ds + 'T00:00:00')
          .lt('created_at',  ds + 'T23:59:59')
          .neq('status', 'cancelled')
        const rev = dayOrd?.reduce((s, o) => s + Number(o.total), 0) || 0
        chartData.push({ date: d.toLocaleDateString('th-TH', { weekday:'short', day:'numeric' }), ยอดขาย: rev, จำนวน: dayOrd?.length || 0 })
      }
      setSalesChart(chartData)

      // สินค้าขายดี — กรองออเดอร์ที่ถูกยกเลิกออก
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

      // ออเดอร์ล่าสุด
      const { data: recent } = await supabase
        .from('orders').select('order_number, total, status, created_at')
        .order('created_at', { ascending: false }).limit(5)
      setRecentOrders(recent || [])

      // สต็อกใกล้หมด
      const { data: invItems } = await supabase.from('inventory').select('*')
      setLowStock((invItems || []).filter(i => Number(i.quantity) <= Number(i.min_quantity)))

      setStats({ todayRevenue, todayCount, monthRevenue, pendingCount: pendingCount || 0 })
      setLoading(false)
    })()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-coffee-600 text-lg">กำลังโหลดข้อมูล... ☕</div>
  )

  const STATUS_BADGE = {
    pending:   'badge-pending', preparing: 'badge-preparing',
    ready:     'badge-ready',   completed: 'badge-completed', cancelled: 'badge-cancelled',
  }
  const STATUS_TH = {
    pending:'รอ', preparing:'ทำอยู่', ready:'พร้อม', completed:'เสร็จ', cancelled:'ยกเลิก'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">แดชบอร์ด</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp}   label="ยอดขายวันนี้"   value={`฿${stats.todayRevenue.toLocaleString()}`}  sub={`${stats.todayCount} ออเดอร์`} color="coffee" />
        <StatCard icon={ShoppingBag}  label="ยอดขายเดือนนี้" value={`฿${stats.monthRevenue.toLocaleString()}`} sub="รวมทุกออเดอร์" color="green" />
        <StatCard icon={Clock}        label="รอดำเนินการ"     value={stats.pendingCount}  sub="ออเดอร์ที่ยังค้างอยู่" color="blue" />
        <StatCard icon={AlertTriangle} label="สต็อกใกล้หมด"  value={lowStock.length}     sub="รายการที่ต้องเติม" color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Area Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-700 mb-4">ยอดขาย 7 วันล่าสุด</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a96318" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a96318" stopOpacity={0} />
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

        {/* Pie Chart */}
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
          <h2 className="font-semibold text-gray-700 mb-3">ออเดอร์ล่าสุด</h2>
          {recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">ยังไม่มีออเดอร์</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div key={o.order_number} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-bold text-gray-500 w-12">#{o.order_number}</span>
                  <span className={STATUS_BADGE[o.status] + ' text-xs'}>{STATUS_TH[o.status]}</span>
                  <span className="flex-1 text-gray-400 text-xs">
                    {new Date(o.created_at).toLocaleString('th-TH', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })}
                  </span>
                  <span className="font-bold text-coffee-700">฿{Number(o.total).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div className="card p-5 border-red-100">
          <h2 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> วัตถุดิบที่ต้องเติมด่วน
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {lowStock.map(i => (
              <div key={i.id} className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="font-medium text-red-700 text-sm">{i.name}</p>
                <p className="text-red-500 text-xs mt-1">
                  คงเหลือ {Number(i.quantity).toLocaleString()} / ขั้นต่ำ {Number(i.min_quantity).toLocaleString()} {i.unit}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
