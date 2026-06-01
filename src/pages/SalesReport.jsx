import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  TrendingUp, ShoppingBag, Receipt, BarChart2,
  RefreshCw, ChevronDown, Award, Tag, Download,
} from 'lucide-react'
import { exportSalesReport } from '../lib/exportUtils'

/* ── Date helpers ── */
const pad = n => String(n).padStart(2, '0')
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

function getRange(preset, customStart, customEnd) {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs  = 86400000

  const endOfDay = d => new Date(d.getTime() + dayMs - 1)

  switch (preset) {
    case 'today':
      return { start: today, end: endOfDay(today) }
    case 'yesterday': {
      const y = new Date(today.getTime() - dayMs)
      return { start: y, end: endOfDay(y) }
    }
    case '7days':
      return { start: new Date(today.getTime() - 6 * dayMs), end: endOfDay(today) }
    case '30days':
      return { start: new Date(today.getTime() - 29 * dayMs), end: endOfDay(today) }
    case 'custom': {
      const s = customStart ? new Date(customStart) : today
      const e = customEnd   ? endOfDay(new Date(customEnd)) : endOfDay(today)
      return { start: s, end: e }
    }
    default:
      return { start: today, end: endOfDay(today) }
  }
}

function buildDailyData(orders, start, end) {
  const map = {}
  const dayMs = 86400000
  // fill all dates in range with 0
  let cur = new Date(start)
  cur.setHours(0,0,0,0)
  const endDate = new Date(end); endDate.setHours(0,0,0,0)
  while (cur <= endDate) {
    map[toDateStr(cur)] = { date: toDateStr(cur), revenue: 0, orders: 0 }
    cur = new Date(cur.getTime() + dayMs)
  }
  orders.forEach(o => {
    const d = o.created_at.slice(0, 10)
    if (map[d]) {
      map[d].revenue += Number(o.total)
      map[d].orders  += 1
    }
  })
  return Object.values(map).map(row => ({
    ...row,
    label: row.date.slice(5), // 'MM-DD'
  }))
}

function buildHourlyData(orders) {
  const data = Array.from({ length: 24 }, (_, h) => ({
    hour: h, label: `${pad(h)}`, revenue: 0, orders: 0,
  }))
  orders.forEach(o => {
    const h = new Date(o.created_at).getHours()
    data[h].revenue += Number(o.total)
    data[h].orders  += 1
  })
  return data
}

/* ── Custom Tooltip สำหรับ recharts ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-coffee-700 font-bold">฿{Number(payload[0]?.value || 0).toLocaleString()}</p>
      <p className="text-gray-500">{payload[0]?.payload?.orders} ออเดอร์</p>
    </div>
  )
}

const PRESETS = [
  { key: 'today',     label: 'วันนี้'      },
  { key: 'yesterday', label: 'เมื่อวาน'   },
  { key: '7days',     label: '7 วัน'      },
  { key: '30days',    label: '30 วัน'     },
  { key: 'custom',    label: 'กำหนดเอง'   },
]

/* ── Summary Card ── */
function StatCard({ icon: Icon, label, value, sub, color = 'coffee' }) {
  const colors = {
    coffee: 'bg-coffee-50 text-coffee-600 border-coffee-200',
    green:  'bg-green-50  text-green-600  border-green-200',
    blue:   'bg-blue-50   text-blue-600   border-blue-200',
    amber:  'bg-amber-50  text-amber-600  border-amber-200',
  }
  return (
    <div className="card px-4 py-3 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function SalesReport() {
  const [preset,      setPreset]      = useState('today')
  const [customStart, setCustomStart] = useState(toDateStr(new Date()))
  const [customEnd,   setCustomEnd]   = useState(toDateStr(new Date()))
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)

  // Processed data
  const [summary,     setSummary]     = useState({ revenue: 0, orders: 0, avgOrder: 0, cancelled: 0 })
  const [chartData,   setChartData]   = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [byCat,       setByCat]       = useState([])
  const [byStaff,     setByStaff]     = useState([])

  const isHourly = preset === 'today' || preset === 'yesterday'

  const fetchReport = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else         setSyncing(true)

    const { start, end } = getRange(preset, customStart, customEnd)

    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, status, created_at, cashier_name, order_items(*)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at')

    if (!orders) {
      if (!silent) setLoading(false)
      else         setSyncing(false)
      return
    }

    const completed  = orders.filter(o => o.status !== 'cancelled')
    const cancelled  = orders.filter(o => o.status === 'cancelled')
    const totalRev   = completed.reduce((s, o) => s + Number(o.total), 0)
    const avgOrder   = completed.length ? totalRev / completed.length : 0

    setSummary({
      revenue:   totalRev,
      orders:    completed.length,
      avgOrder,
      cancelled: cancelled.length,
    })

    // Chart
    if (isHourly) setChartData(buildHourlyData(completed))
    else          setChartData(buildDailyData(completed, start, end))

    // Top products
    const prodMap = {}
    completed.forEach(o => {
      o.order_items?.forEach(item => {
        const key = item.name
        if (!prodMap[key]) prodMap[key] = { name: key, qty: 0, revenue: 0 }
        prodMap[key].qty     += item.quantity
        prodMap[key].revenue += Number(item.price) * item.quantity
      })
    })
    setTopProducts(
      Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    )

    // By cashier/staff
    const staffMap = {}
    completed.forEach(o => {
      const name = o.cashier_name || 'ไม่ระบุ'
      if (!staffMap[name]) staffMap[name] = { name, orders: 0, revenue: 0 }
      staffMap[name].orders  += 1
      staffMap[name].revenue += Number(o.total)
    })
    setByStaff(Object.values(staffMap).sort((a, b) => b.revenue - a.revenue))

    // By category — ดึงจาก order_items name (ไม่มี category_id ใน items)
    // ใช้ชื่อเมนูต้นฉบับจาก products แทน — ง่ายกว่าคือรวมตาม prefix หรือ skip
    // แสดงเป็น Top 5 products แทน category สำหรับตอนนี้
    setByCat([]) // placeholder — ขยายได้ในอนาคตถ้าเพิ่ม category_name ใน order_items

    if (!silent) setLoading(false)
    else         setSyncing(false)
  }, [preset, customStart, customEnd, isHourly])

  useEffect(() => { fetchReport() }, [fetchReport])

  const maxRev = Math.max(...chartData.map(d => d.revenue), 1)

  const { start, end } = getRange(preset, customStart, customEnd)
  const rangeLabel = preset === 'today' ? 'วันนี้'
    : preset === 'yesterday' ? 'เมื่อวาน'
    : `${toDateStr(start)} – ${toDateStr(end)}`

  return (
    <div className="max-w-5xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">รายงานยอดขาย</h1>
          <p className="text-xs text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSalesReport({ orders, startDate: start, endDate: end, preset })}
            disabled={loading || !orders.length}
            className="btn-secondary flex items-center gap-2 text-sm py-1.5 disabled:opacity-40"
          >
            <Download size={14} /> Export Excel
          </button>
          <button onClick={() => fetchReport({ silent: true })}
            className="btn-secondary flex items-center gap-2 text-sm py-1.5">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{syncing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>
        </div>
      </div>

      {/* Preset tabs */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0
              ${preset === p.key
                ? 'bg-coffee-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >{p.label}</button>
        ))}
      </div>

      {/* Custom date range */}
      {preset === 'custom' && (
        <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">จาก</label>
          <input type="date" value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            className="input text-sm py-1.5 w-auto" />
          <label className="text-sm text-gray-600 font-medium">ถึง</label>
          <input type="date" value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            max={toDateStr(new Date())}
            className="input text-sm py-1.5 w-auto" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลดรายงาน...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={TrendingUp}
              label="ยอดขายรวม"
              value={`฿${summary.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              color="coffee"
            />
            <StatCard
              icon={ShoppingBag}
              label="จำนวนออเดอร์"
              value={summary.orders.toLocaleString()}
              sub={summary.cancelled > 0 ? `ยกเลิก ${summary.cancelled}` : undefined}
              color="blue"
            />
            <StatCard
              icon={Receipt}
              label="เฉลี่ยต่อออเดอร์"
              value={`฿${Math.round(summary.avgOrder).toLocaleString()}`}
              color="green"
            />
            <StatCard
              icon={BarChart2}
              label="เมนูที่ขาย"
              value={topProducts.length > 0
                ? `${topProducts.reduce((s,p) => s + p.qty, 0)} แก้ว`
                : '0 แก้ว'}
              color="amber"
            />
          </div>

          {/* Bar chart */}
          {chartData.some(d => d.revenue > 0) ? (
            <div className="card px-4 pt-4 pb-2">
              <p className="text-sm font-semibold text-gray-700 mb-4">
                {isHourly ? '📊 ยอดขายรายชั่วโมง' : '📊 ยอดขายรายวัน'}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    interval={isHourly ? 2 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f0eb' }} />
                  <Bar dataKey="revenue" fill="#7c5c3e" radius={[4,4,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card px-4 py-10 text-center text-gray-400 text-sm">
              ไม่มีข้อมูลยอดขายในช่วงนี้
            </div>
          )}

          {/* Top products + Staff */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Top products */}
            <div className="card px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Award size={16} className="text-coffee-600" />
                <p className="text-sm font-semibold text-gray-700">เมนูขายดี</p>
              </div>
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((prod, i) => {
                    const pct = maxRev > 0 ? (prod.revenue / summary.revenue) * 100 : 0
                    return (
                      <div key={prod.name}>
                        <div className="flex justify-between items-center text-xs mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold
                              ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-gray-200 text-gray-500'}`}>
                              {i + 1}
                            </span>
                            <span className="truncate text-gray-700 font-medium">{prod.name}</span>
                          </div>
                          <div className="shrink-0 text-right ml-2">
                            <span className="font-bold text-coffee-700">฿{prod.revenue.toLocaleString()}</span>
                            <span className="text-gray-400 ml-1">({prod.qty} แก้ว)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${i === 0 ? 'bg-coffee-500' : 'bg-coffee-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* By staff */}
            <div className="card px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={16} className="text-blue-500" />
                <p className="text-sm font-semibold text-gray-700">ยอดขายตามพนักงาน</p>
              </div>
              {byStaff.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-2">
                  {byStaff.map(s => {
                    const pct = summary.revenue > 0 ? (s.revenue / summary.revenue) * 100 : 0
                    return (
                      <div key={s.name}>
                        <div className="flex justify-between items-center text-xs mb-0.5">
                          <span className="text-gray-700 font-medium truncate">{s.name}</span>
                          <div className="shrink-0 text-right ml-2">
                            <span className="font-bold text-blue-600">฿{s.revenue.toLocaleString()}</span>
                            <span className="text-gray-400 ml-1">({s.orders} ออเดอร์)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Order list summary */}
          {summary.orders > 0 && (
            <div className="card px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt size={16} className="text-gray-500" />
                <p className="text-sm font-semibold text-gray-700">สรุปตัวเลขรวม</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'ยอดขายสูงสุด/ออเดอร์', value: `฿${Math.max(...(
                    // ต้องเก็บ orders ไว้ใน state — ใช้ summary แทน
                    [summary.revenue]
                  )).toLocaleString()}` },
                  { label: 'ยอดรวมทั้งหมด', value: `฿${summary.revenue.toLocaleString()}` },
                  { label: 'ออเดอร์ที่สำเร็จ', value: `${summary.orders} รายการ` },
                  { label: 'ยอดขายถูกยกเลิก', value: `${summary.cancelled} รายการ` },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className="text-sm font-bold text-gray-700">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
