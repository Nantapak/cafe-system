import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { printReceipt } from '../lib/printUtils'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, ChevronDown, Printer, User } from 'lucide-react'

const STATUS_LABELS = {
  pending:   { label: 'รอดำเนินการ', badge: 'badge-pending',   next: 'preparing', nextLabel: 'เริ่มทำ' },
  preparing: { label: 'กำลังทำ',    badge: 'badge-preparing', next: 'ready',     nextLabel: 'พร้อมเสิร์ฟ' },
  ready:     { label: 'พร้อมเสิร์ฟ', badge: 'badge-ready',    next: 'completed', nextLabel: 'จัดส่งแล้ว' },
  completed: { label: 'เสร็จสิ้น',  badge: 'badge-completed', next: null,        nextLabel: null },
  cancelled: { label: 'ยกเลิก',     badge: 'badge-cancelled', next: null,        nextLabel: null },
}

export default function Orders() {
  const { user } = useAuth()
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [expandId, setExpandId] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handlerName = user?.user_metadata?.name || user?.user_metadata?.username || 'ไม่ทราบ'

  const updateStatus = async (id, status) => {
    await supabase.from('orders').update({
      status,
      handled_by_id:   user?.id   || null,
      handled_by_name: handlerName,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    fetchOrders()
  }

  const cancelOrder = async (id) => {
    if (!confirm('ยืนยันการยกเลิกออเดอร์?')) return
    await supabase.from('orders').update({
      status:          'cancelled',
      handled_by_id:   user?.id   || null,
      handled_by_name: handlerName,
    }).eq('id', id)
    fetchOrders()
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
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">รายการออเดอร์</h1>
        <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <RefreshCw size={14} /> รีเฟรช
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {[['all','ทั้งหมด'], ...Object.entries(STATUS_LABELS).map(([k,v]) => [k, v.label])].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
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
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandId(isExpanded ? null : order.id)}
                >
                  <span className={s.badge}>{s.label}</span>
                  <span className="font-bold text-gray-700">#{order.order_number}</span>
                  <span className="text-sm text-gray-500 hidden sm:inline">{fmtDate(order.created_at)}</span>
                  {order.cashier_name && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
                      <User size={11} />{order.cashier_name}
                    </span>
                  )}
                  <span className="ml-auto font-bold text-coffee-700">฿{Number(order.total).toLocaleString()}</span>
                  <span className="text-sm text-gray-400">
                    {order.order_items?.length || 0} รายการ
                  </span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    {/* Items */}
                    <div className="space-y-1 mb-3">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.name} × {item.quantity}</span>
                          <span className="text-gray-600">฿{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {/* ข้อมูลผู้ดำเนินการ */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-400">
                      <span className="sm:hidden">{fmtDate(order.created_at)}</span>
                      {order.cashier_name && (
                        <span className="flex items-center gap-1">
                          <User size={11} /> สั่งโดย <span className="font-medium text-gray-600">{order.cashier_name}</span>
                        </span>
                      )}
                      {order.handled_by_name && (
                        <span className="flex items-center gap-1">
                          <User size={11} /> อัปเดตโดย <span className="font-medium text-gray-600">{order.handled_by_name}</span>
                        </span>
                      )}
                    </div>

                    {order.note && (
                      <p className="text-xs text-gray-500 mb-3 bg-yellow-50 border border-yellow-100 rounded px-2 py-1">
                        📝 {order.note}
                      </p>
                    )}
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {s.next && (
                        <button
                          onClick={() => updateStatus(order.id, s.next)}
                          className="btn-primary text-sm py-1.5 px-3"
                        >
                          {s.nextLabel}
                        </button>
                      )}
                      {!['completed','cancelled'].includes(order.status) && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="btn-danger text-sm py-1.5 px-3"
                        >
                          ยกเลิก
                        </button>
                      )}
                      {/* ปุ่มปริ้น */}
                      <button
                        onClick={() => printReceipt(order, order.order_items || [])}
                        title="ปริ้นใบเสร็จ"
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
