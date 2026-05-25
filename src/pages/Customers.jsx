import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, X, Star, Coffee, Phone, User, History, ChevronDown, ChevronUp, Check } from 'lucide-react'

const EMPTY_FORM = { name: '', phone: '' }

export default function Customers() {
  const [customers,   setCustomers]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [editId,      setEditId]      = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [expandedId,  setExpandedId]  = useState(null)   // ดูประวัติ
  const [txHistory,   setTxHistory]   = useState([])
  const [txLoading,   setTxLoading]   = useState(false)
  const [adjustModal, setAdjustModal] = useState(null)   // { customer, delta }
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustNote,  setAdjustNote]  = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  /* ── CRUD ── */
  const openNew = () => {
    setForm(EMPTY_FORM); setEditId(null); setShowModal(true)
  }
  const openEdit = (c) => {
    setForm({ name: c.name, phone: c.phone })
    setEditId(c.id); setShowModal(true)
  }
  const saveCustomer = async () => {
    const phone = form.phone.trim().replace(/\D/g, '')
    if (!form.name.trim() || !phone) return alert('กรุณากรอกชื่อและเบอร์โทร')
    setSaving(true)
    const payload = { name: form.name.trim(), phone }
    if (editId) {
      await supabase.from('customers').update(payload).eq('id', editId)
    } else {
      const { error } = await supabase.from('customers').insert(payload)
      if (error?.message?.includes('unique')) {
        setSaving(false)
        return alert('เบอร์นี้มีสมาชิกอยู่แล้ว')
      }
    }
    setSaving(false); setShowModal(false); fetchAll()
  }
  const deleteCustomer = async (id) => {
    if (!confirm('ลบสมาชิกนี้? ประวัติแต้มจะถูกลบด้วย')) return
    await supabase.from('customers').delete().eq('id', id); fetchAll()
  }

  /* ── ประวัติแต้ม ── */
  const toggleHistory = async (id) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id); setTxLoading(true)
    const { data } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    setTxHistory(data || [])
    setTxLoading(false)
  }

  /* ── ปรับแต้มด้วยมือ ── */
  const openAdjust = (c) => {
    setAdjustModal(c); setAdjustDelta(''); setAdjustNote('')
  }
  const saveAdjust = async () => {
    const delta = parseInt(adjustDelta)
    if (isNaN(delta) || delta === 0) return alert('กรอกจำนวนแต้ม (+บวก หรือ -ลบ)')
    const newPoints = Math.max(0, adjustModal.points + delta)
    await supabase.from('customers').update({ points: newPoints }).eq('id', adjustModal.id)
    await supabase.from('point_transactions').insert({
      customer_id:   adjustModal.id,
      points_change: delta,
      type:          'adjust',
      note:          adjustNote.trim() || `ปรับด้วยมือ ${delta > 0 ? '+' : ''}${delta}`,
    })
    setAdjustModal(null); fetchAll()
    if (expandedId === adjustModal.id) {
      const { data } = await supabase.from('point_transactions')
        .select('*').eq('customer_id', adjustModal.id)
        .order('created_at', { ascending: false }).limit(20)
      setTxHistory(data || [])
    }
  }

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const ProgressBar = ({ points }) => {
    const pct = Math.min(100, (points % 10) / 10 * 100)
    const full = Math.floor(points / 10)
    return (
      <div>
        <div className="flex items-center gap-1 mb-1">
          {[...Array(10)].map((_, i) => (
            <div key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < (points % 10) ? 'bg-amber-400' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400">
          {points % 10}/10 แต้ม
          {full > 0 && <span className="ml-1 text-amber-600 font-medium">({full} แก้วฟรีสะสม)</span>}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">สมาชิก</h1>
          <p className="text-sm text-gray-400 mt-0.5">แก้วละ 1 แต้ม · สะสม 10 แต้ม รับฟรี 1 แก้ว</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> เพิ่มสมาชิก
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-coffee-700">{customers.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">สมาชิกทั้งหมด</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {customers.reduce((s, c) => s + c.total_cups, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">แก้วสะสมรวม</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {customers.filter(c => c.points >= 10).length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">พร้อมแลกแต้ม</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Star size={40} className="mx-auto mb-3 opacity-20" />
          <p>ยังไม่มีสมาชิก</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <User size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-800">{c.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star size={10} /> {c.points} แต้ม
                        </span>
                        {c.points >= 10 && (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            🎁 แลกได้!
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone size={11} /> {c.phone}
                      <span className="mx-1">·</span>
                      <Coffee size={11} /> {c.total_cups} แก้ว
                    </p>
                    <div className="mt-2">
                      <ProgressBar points={c.points} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t border-gray-100">
                <button onClick={() => toggleHistory(c.id)}
                  className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1 transition-colors">
                  <History size={12} />
                  ประวัติ
                  {expandedId === c.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <button onClick={() => openAdjust(c)}
                  className="flex-1 py-2 text-xs text-amber-600 hover:bg-amber-50 flex items-center justify-center gap-1 transition-colors border-l border-gray-100">
                  <Star size={12} /> ปรับแต้ม
                </button>
                <button onClick={() => openEdit(c)}
                  className="flex-1 py-2 text-xs text-blue-500 hover:bg-blue-50 flex items-center justify-center gap-1 transition-colors border-l border-gray-100">
                  แก้ไข
                </button>
                <button onClick={() => deleteCustomer(c.id)}
                  className="flex-1 py-2 text-xs text-red-400 hover:bg-red-50 flex items-center justify-center gap-1 transition-colors border-l border-gray-100">
                  ลบ
                </button>
              </div>

              {/* ประวัติแต้ม */}
              {expandedId === c.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 mb-2">ประวัติล่าสุด</p>
                  {txLoading ? (
                    <p className="text-xs text-gray-400 text-center py-3">กำลังโหลด...</p>
                  ) : txHistory.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">ยังไม่มีประวัติ</p>
                  ) : (
                    <div className="space-y-1.5">
                      {txHistory.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 truncate flex-1">{tx.note || tx.type}</span>
                          <span className={`font-bold ml-2 shrink-0 ${
                            tx.points_change >= 0 ? 'text-green-600' : 'text-red-500'
                          }`}>
                            {tx.points_change >= 0 ? '+' : ''}{tx.points_change}
                          </span>
                          <span className="text-gray-300 ml-2 shrink-0">{fmtDate(tx.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: เพิ่ม/แก้ไขสมาชิก */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-800">{editId ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิกใหม่'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อ *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล หรือชื่อเล่น" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เบอร์โทร *</label>
                <input className="input" type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0812345678" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={saveCustomer} disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ปรับแต้มด้วยมือ */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="font-bold text-gray-800">ปรับแต้ม</h2>
                <p className="text-xs text-gray-400">{adjustModal.name} · ปัจจุบัน {adjustModal.points} แต้ม</p>
              </div>
              <button onClick={() => setAdjustModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  จำนวนแต้ม (ใส่ + เพิ่ม หรือ - ลด)
                </label>
                <input className="input text-center text-lg font-bold" type="number"
                  value={adjustDelta}
                  onChange={e => setAdjustDelta(e.target.value)}
                  placeholder="+5 หรือ -3" />
                {adjustDelta && !isNaN(parseInt(adjustDelta)) && (
                  <p className="text-xs text-center mt-1 text-gray-500">
                    แต้มใหม่: {Math.max(0, adjustModal.points + parseInt(adjustDelta))} แต้ม
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
                <input className="input" value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="เช่น โปรพิเศษวันเกิด" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setAdjustModal(null)} className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={saveAdjust} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Check size={16} /> บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
