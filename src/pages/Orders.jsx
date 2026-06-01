import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { printReceipt } from '../lib/printUtils'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, ChevronDown, Printer, ShoppingCart, ChefHat, Bell, CheckCircle2, XCircle, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const STATUS_LABELS = {
  pending:   { label: 'รอดำเนินการ', badge: 'badge-pending',   next: 'preparing', nextLabel: 'เริ่มทำ' },
  preparing: { label: 'กำลังทำ',    badge: 'badge-preparing', next: 'ready',     nextLabel: 'พร้อมเสิร์ฟ' },
  ready:     { label: 'พร้อมเสิร์ฟ', badge: 'badge-ready',    next: 'completed', nextLabel: 'จัดส่งแล้ว' },
  completed: { label: 'เสร็จสิ้น',  badge: 'badge-completed', next: null,        nextLabel: null },
  cancelled: { label: 'ยกเลิก',     badge: 'badge-cancelled', next: null,        nextLabel: null },
}

/* ── Timeline: แสดงว่าใครทำอะไรแต่ละขั้นตอน ── */
function OrderTimeline({ order }) {
  const fmtTime = (d) => d ? new Date(d).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }) : null

  const steps = [
    {
      key:    'pending',
      icon:   ShoppingCart,
      label:  'สั่งออเดอร์',
      name:   order.cashier_name,
      time:   order.created_at,
      color:  'text-blue-500',
      bg:     'bg-blue-50 border-blue-200',
      dot:    'bg-blue-400',
      done:   true,
    },
    {
      key:    'preparing',
      icon:   ChefHat,
      label:  'เริ่มทำ',
      name:   order.prepared_by_name,
      time:   order.prepared_at,
      color:  'text-orange-500',
      bg:     'bg-orange-50 border-orange-200',
      dot:    'bg-orange-400',
      done:   !!order.prepared_by_name,
    },
    {
      key:    'ready',
      icon:   Bell,
      label:  'พร้อมเสิร์ฟ',
      name:   order.ready_by_name,
      time:   order.ready_at,
      color:  'text-green-500',
      bg:     'bg-green-50 border-green-200',
      dot:    'bg-green-400',
      done:   !!order.ready_by_name,
    },
    order.status === 'cancelled'
      ? {
          key:   'cancelled',
          icon:  XCircle,
          label: 'ยกเลิก',
          name:  order.cancelled_by_name,
          time:  null,
          color: 'text-red-500',
          bg:    'bg-red-50 border-red-200',
          dot:   'bg-red-400',
          done:  !!order.cancelled_by_name,
        }
      : {
          key:   'completed',
          icon:  CheckCircle2,
          label: 'จัดส่งแล้ว',
          name:  order.completed_by_name,
          time:  order.completed_at,
          color: 'text-coffee-600',
          bg:    'bg-coffee-50 border-coffee-200',
          dot:   'bg-coffee-500',
          done:  !!order.completed_by_name,
        },
  ]

  // แสดงเฉพาะขั้นตอนที่เกิดขึ้นแล้ว + ขั้นตอนถัดไป
  const currentIdx = steps.findLastIndex(s => s.done)
  const visible = steps.slice(0, currentIdx + 2)

  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ผู้ดำเนินการ</p>
      <div className="flex flex-col gap-1.5">
        {visible.map((step, idx) => {
          const Icon = step.icon
          const time = fmtTime(step.time)
          return (
            <div key={step.key}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border text-xs
                ${step.done ? step.bg : 'bg-gray-50 border-gray-100 opacity-40'}`}
            >
              {/* dot + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-2 h-2 rounded-full ${step.done ? step.dot : 'bg-gray-300'}`} />
                {idx < visible.length - 1 && (
                  <div className="w-px h-3 bg-gray-200 mt-0.5" />
                )}
              </div>
              <Icon size={13} className={step.done ? step.color : 'text-gray-300'} />
              <span className={`font-semibold ${step.done ? 'text-gray-700' : 'text-gray-300'}`}>
                {step.label}
              </span>
              {step.done && step.name ? (
                <>
                  <span className="text-gray-400">โดย</span>
                  <span className={`font-bold ${step.color}`}>{step.name}</span>
                  {time && <span className="ml-auto text-gray-400 shrink-0">{time}</span>}
                </>
              ) : (
                <span className="text-gray-300 italic">รอดำเนินการ</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── helper: YYYY-MM-DD string ── */
const toDateStr = (d) => d.toISOString().split('T')[0]
const today     = () => toDateStr(new Date())
const yesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return toDateStr(d) }
const fmtDisplayDate = (str) => new Date(str + 'T12:00:00').toLocaleDateString('th-TH', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

export default function Orders() {
  const { user } = useAuth()
  const [orders,      setOrders]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [live,        setLive]        = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [expandId,    setExpandId]    = useState(null)
  const [selectedDate, setSelectedDate] = useState(today())   // YYYY-MM-DD

  const filterRef = useRef(filter)
  const dateRef   = useRef(selectedDate)
  filterRef.current = filter
  dateRef.current   = selectedDate

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setSyncing(true)

    let q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_date', dateRef.current)
      .order('order_number', { ascending: true })
    if (filterRef.current !== 'all') q = q.eq('status', filterRef.current)
    const { data } = await q
    setOrders(data || [])

    if (!silent) setLoading(false)
    else setSyncing(false)
  }, [])

  useEffect(() => {
    filterRef.current = filter
    fetchOrders()
  }, [filter, fetchOrders])

  useEffect(() => {
    dateRef.current = selectedDate
    fetchOrders()
  }, [selectedDate, fetchOrders])

  /* เลื่อนวัน */
  const shiftDate = (delta) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(toDateStr(d))
  }
  const isToday = selectedDate === today()

  /* ── Realtime ── */
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'orders' },
        () => fetchOrders({ silent: true }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' },
        () => fetchOrders({ silent: true }))
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  const handlerName = user?.user_metadata?.name || user?.user_metadata?.username || 'ไม่ทราบ'

  /* บันทึก per-step ว่าใครกดอะไร */
  const updateStatus = async (id, status) => {
    const now = new Date().toISOString()
    const extra = {
      preparing: { prepared_by_name: handlerName, prepared_at: now },
      ready:     { ready_by_name: handlerName,     ready_at: now },
      completed: { completed_by_name: handlerName, completed_at: now },
    }[status] || {}

    await supabase.from('orders').update({
      status,
      handled_by_id:   user?.id || null,
      handled_by_name: handlerName,
      ...extra,
    }).eq('id', id)

    fetchOrders({ silent: true })
  }

  const cancelOrder = async (id) => {
    if (!confirm('ยืนยันการยกเลิกออเดอร์?')) return

    // ดึงข้อมูลออเดอร์ก่อนยกเลิก เพื่อคืนแต้มสมาชิก
    const { data: order } = await supabase
      .from('orders')
      .select('customer_id, points_earned, points_redeemed, order_number')
      .eq('id', id).single()

    await supabase.from('orders').update({
      status:            'cancelled',
      handled_by_id:     user?.id || null,
      handled_by_name:   handlerName,
      cancelled_by_name: handlerName,
    }).eq('id', id)

    // คืนแต้มให้สมาชิก (ถ้ามี)
    if (order?.customer_id && (order.points_earned > 0 || order.points_redeemed > 0)) {
      const { data: cust } = await supabase
        .from('customers').select('points, total_cups').eq('id', order.customer_id).single()
      if (cust) {
        // ยกเลิก: ลบแต้มที่ได้รับ + คืนแต้มที่ใช้แลก
        const pointsBack  = order.points_redeemed || 0   // คืนแต้มที่แลกไป
        const pointsTaken = order.points_earned   || 0   // เอาแต้มที่ได้รับคืน
        const cupsBack    = pointsTaken                  // คืนจำนวนแก้ว
        const newPoints   = Math.max(0, cust.points - pointsTaken + pointsBack)
        const newCups     = Math.max(0, cust.total_cups - cupsBack)

        await supabase.from('customers').update({
          points:     newPoints,
          total_cups: newCups,
        }).eq('id', order.customer_id)

        await supabase.from('point_transactions').insert({
          customer_id:   order.customer_id,
          order_id:      id,
          points_change: pointsBack - pointsTaken,
          type:          'adjust',
          note:          `ยกเลิกออเดอร์ #${order.order_number} (คืนแต้ม)`,
        })
      }
    }

    fetchOrders({ silent: true })
  }

  /* ── ปริ้นใบเสร็จพร้อมข้อมูลสมาชิก (ถ้ามี) ── */
  const handlePrint = async (order) => {
    let memberInfo = null
    if (order.customer_id) {
      const { data: cust } = await supabase
        .from('customers').select('id, points').eq('id', order.customer_id).single()
      if (cust) {
        memberInfo = {
          id:           cust.id,
          points:       cust.points,
          pointsEarned: order.points_earned   || 0,
          pointsUsed:   order.points_redeemed || 0,
        }
      }
    }
    printReceipt(order, order.order_items || [], memberInfo)
  }

  const fmtDate = (d) => new Date(d).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const filterCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">ออเดอร์</h1>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> กำลังเชื่อมต่อ...
            </span>
          )}
        </div>
        <button onClick={() => fetchOrders()} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{syncing ? 'กำลังอัปเดต...' : 'รีเฟรช'}</span>
        </button>
      </div>

      {/* ── Date navigator ── */}
      <div className="card px-4 py-3 mb-4 flex items-center gap-3">
        {/* ลูกศรย้อนหลัง */}
        <button onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </button>

        {/* วันที่แสดง */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <CalendarDays size={15} className="text-coffee-500" />
            <p className="text-sm font-bold text-gray-800">{fmtDisplayDate(selectedDate)}</p>
            {isToday && (
              <span className="text-xs bg-coffee-600 text-white px-2 py-0.5 rounded-full font-semibold">วันนี้</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {orders.length} ออเดอร์
            {orders.length > 0 && (
              <> · ยอดรวม ฿{orders.filter(o => o.status !== 'cancelled').reduce((s,o) => s + Number(o.total), 0).toLocaleString()}</>
            )}
          </p>
        </div>

        {/* ลูกศรไปข้างหน้า (disable ถ้าวันนี้แล้ว) */}
        <button onClick={() => shiftDate(1)} disabled={isToday}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30">
          <ChevronRight size={18} />
        </button>

        {/* ปุ่มวันนี้ + date picker */}
        <div className="flex items-center gap-1.5 border-l border-gray-100 pl-3">
          {!isToday && (
            <button onClick={() => setSelectedDate(today())}
              className="text-xs px-2.5 py-1.5 bg-coffee-600 text-white rounded-lg font-medium hover:bg-coffee-700 transition-colors">
              วันนี้
            </button>
          )}
          <input
            type="date"
            value={selectedDate}
            max={today()}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600
                       focus:outline-none focus:ring-2 focus:ring-coffee-600/20 focus:border-coffee-600"
          />
        </div>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[['all','ทั้งหมด'], ...Object.entries(STATUS_LABELS).map(([k,v]) => [k, v.label])].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === key ? 'bg-coffee-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
            {key !== 'all' && filterCounts[key] ? (
              <span className="ml-1.5 bg-white/30 px-1.5 rounded-full text-xs">{filterCounts[key]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">ไม่มีออเดอร์</div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const s = STATUS_LABELS[order.status] || STATUS_LABELS.pending
            const isExpanded = expandId === order.id
            return (
              <div key={order.id} className="card overflow-hidden">

                {/* Header row */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandId(isExpanded ? null : order.id)}
                >
                  <span className={s.badge}>{s.label}</span>
                  <span className="font-bold text-gray-700">#{order.order_number}</span>
                  <span className="text-sm text-gray-500 hidden sm:inline">{fmtDate(order.created_at)}</span>

                  {/* ชื่อคนสั่ง */}
                  {order.cashier_name && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      <ShoppingCart size={10} />
                      {order.cashier_name}
                    </span>
                  )}
                  {/* ชื่อคนที่กำลังทำ/ล่าสุด */}
                  {order.prepared_by_name && !order.completed_by_name && !order.cancelled_by_name && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                      <ChefHat size={10} />
                      {order.prepared_by_name}
                    </span>
                  )}

                  <span className="ml-auto font-bold text-coffee-700">฿{Number(order.total).toLocaleString()}</span>
                  <span className="text-sm text-gray-400">{order.order_items?.length || 0} รายการ</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">

                    {/* รายการสินค้า */}
                    <div className="space-y-1 mb-4">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.name} × {item.quantity}
                            {item.note && <span className="ml-2 text-xs text-gray-400">({item.note})</span>}
                          </span>
                          <span className="text-gray-600 shrink-0">฿{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {order.note && (
                      <p className="text-xs text-gray-500 mb-4 bg-yellow-50 border border-yellow-100 rounded px-2 py-1.5">
                        📝 {order.note}
                      </p>
                    )}

                    {/* Timeline ผู้ดำเนินการ */}
                    <OrderTimeline order={order} />

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {s.next && (
                        <button onClick={() => updateStatus(order.id, s.next)}
                          className="btn-primary text-sm py-1.5 px-4">
                          {s.nextLabel}
                        </button>
                      )}
                      {!['completed','cancelled'].includes(order.status) && (
                        <button onClick={() => cancelOrder(order.id)}
                          className="btn-danger text-sm py-1.5 px-3">
                          ยกเลิก
                        </button>
                      )}
                      <button
                        onClick={() => handlePrint(order)}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                                   bg-coffee-50 text-coffee-700 border border-coffee-200 hover:bg-coffee-100 transition-colors"
                      >
                        <Printer size={14} /> ปริ้น
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
