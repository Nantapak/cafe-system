import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, X, Check, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const EMPTY_ITEM = { name: '', unit: 'กรัม', quantity: '', min_quantity: '', cost_per_unit: '' }
const UNITS = ['กรัม', 'กิโลกรัม', 'มล.', 'ลิตร', 'ชิ้น', 'ถุง', 'กล่อง', 'แพ็ค']

export default function Inventory() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState(EMPTY_ITEM)
  const [editId,   setEditId]   = useState(null)
  const [showModal,setShowModal]= useState(false)
  const [adjModal, setAdjModal] = useState(null)
  const [adjQty,   setAdjQty]   = useState('')
  const [adjNote,  setAdjNote]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [txHistory,setTxHistory]= useState([])
  const [showTx,   setShowTx]   = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('inventory').select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openNew  = () => { setForm(EMPTY_ITEM); setEditId(null); setShowModal(true) }
  const openEdit = (item) => {
    setForm({ name: item.name, unit: item.unit, quantity: String(item.quantity),
      min_quantity: String(item.min_quantity), cost_per_unit: String(item.cost_per_unit || '') })
    setEditId(item.id)
    setShowModal(true)
  }

  const saveItem = async () => {
    if (!form.name) return alert('กรุณาใส่ชื่อ')
    setSaving(true)
    const payload = {
      name:          form.name.trim(),
      unit:          form.unit,
      quantity:      parseFloat(form.quantity) || 0,
      min_quantity:  parseFloat(form.min_quantity) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
    }
    if (editId) await supabase.from('inventory').update(payload).eq('id', editId)
    else        await supabase.from('inventory').insert(payload)
    setSaving(false)
    setShowModal(false)
    fetchItems()
  }

  const openAdj = (item, type) => { setAdjModal({ item, type }); setAdjQty(''); setAdjNote('') }

  const saveAdj = async () => {
    if (!adjQty || isNaN(adjQty) || Number(adjQty) <= 0) return alert('กรุณาระบุจำนวน')
    setSaving(true)
    const qty = parseFloat(adjQty)
    const item = adjModal.item
    let newQty = item.quantity
    if (adjModal.type === 'in')     newQty += qty
    if (adjModal.type === 'out')    newQty = Math.max(0, newQty - qty)
    if (adjModal.type === 'adjust') newQty = qty

    await supabase.from('inventory').update({ quantity: newQty }).eq('id', item.id)
    await supabase.from('inventory_transactions').insert({
      inventory_id: item.id,
      type:         adjModal.type,
      quantity:     qty,
      note:         adjNote || null,
    })
    setSaving(false)
    setAdjModal(null)
    fetchItems()
  }

  const fetchTx = async (itemId) => {
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('inventory_id', itemId)
      .order('created_at', { ascending: false })
      .limit(20)
    setTxHistory(data || [])
    setShowTx(itemId)
  }

  const lowItems = items.filter(i => Number(i.quantity) <= Number(i.min_quantity))

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">สต็อกวัตถุดิบ</h1>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> เพิ่มวัตถุดิบ
        </button>
      </div>

      {/* Warning */}
      {lowItems.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">ของใกล้หมด {lowItems.length} รายการ</p>
            <p className="text-xs text-red-500">{lowItems.map(i => i.name).join(', ')}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="card overflow-hidden">

          {/* ───── Mobile: Card list (< md) ───── */}
          <div className="md:hidden divide-y divide-gray-100">
            {items.length === 0 && (
              <p className="text-center py-10 text-gray-400 text-sm">ยังไม่มีวัตถุดิบ</p>
            )}
            {items.map(item => {
              const isLow = Number(item.quantity) <= Number(item.min_quantity)
              return (
                <div key={item.id} className={`px-4 py-3 ${isLow ? 'bg-red-50/40' : ''}`}>
                  <div className="flex items-center gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => fetchTx(item.id)}
                        className="font-semibold text-gray-800 hover:text-coffee-600 transition-colors text-left w-full truncate"
                      >
                        {item.name}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
                          {Number(item.quantity).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400">{item.unit}</span>
                        {isLow ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
                            <AlertTriangle size={10} /> ใกล้หมด
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">ปกติ</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ขั้นต่ำ {Number(item.min_quantity).toLocaleString()} {item.unit}
                        {item.cost_per_unit > 0 && ` · ฿${Number(item.cost_per_unit).toFixed(2)}/หน่วย`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => openAdj(item, 'in')} title="รับเข้า"
                        className="p-2 rounded-lg text-green-500 hover:bg-green-50 transition-colors">
                        <ArrowUpCircle size={18} />
                      </button>
                      <button onClick={() => openAdj(item, 'out')} title="ใช้ออก"
                        className="p-2 rounded-lg text-orange-400 hover:bg-orange-50 transition-colors">
                        <ArrowDownCircle size={18} />
                      </button>
                      <button onClick={() => openEdit(item)} title="แก้ไข"
                        className="p-2 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors">
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ───── Desktop: Table (md+) ───── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">วัตถุดิบ</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">คงเหลือ</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold hidden lg:table-cell">ขั้นต่ำ</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold hidden lg:table-cell">ราคา/หน่วย</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-semibold">สถานะ</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => {
                  const isLow = Number(item.quantity) <= Number(item.min_quantity)
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => fetchTx(item.id)}
                          className="font-medium text-gray-800 hover:text-coffee-600 transition-colors text-left">
                          {item.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
                          {Number(item.quantity).toLocaleString()}
                        </span>
                        <span className="text-gray-400 ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">
                        {Number(item.min_quantity).toLocaleString()} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">
                        ฿{Number(item.cost_per_unit || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLow
                          ? <span className="badge-cancelled flex items-center justify-center gap-1"><AlertTriangle size={10} />ใกล้หมด</span>
                          : <span className="badge-ready">ปกติ</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openAdj(item, 'in')} title="รับเข้า"
                            className="p-1.5 hover:bg-green-50 rounded-lg text-green-500 transition-colors">
                            <ArrowUpCircle size={15} />
                          </button>
                          <button onClick={() => openAdj(item, 'out')} title="ใช้ออก"
                            className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-400 transition-colors">
                            <ArrowDownCircle size={15} />
                          </button>
                          <button onClick={() => openEdit(item)} title="แก้ไข"
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400 transition-colors">
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {items.length === 0 && (
              <p className="text-center py-10 text-gray-400 text-sm">ยังไม่มีวัตถุดิบ</p>
            )}
          </div>
        </div>
      )}

      {/* Tx History Modal */}
      {showTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold">ประวัติการเคลื่อนไหว — {items.find(i => i.id === showTx)?.name}</h2>
              <button onClick={() => setShowTx(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {txHistory.length === 0 ? (
                <p className="text-center text-gray-400 py-8">ยังไม่มีประวัติ</p>
              ) : txHistory.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-gray-50">
                  {tx.type === 'in'     && <ArrowUpCircle   size={16} className="text-green-500 shrink-0" />}
                  {tx.type === 'out'    && <ArrowDownCircle size={16} className="text-orange-400 shrink-0" />}
                  {tx.type === 'adjust' && <Pencil          size={16} className="text-blue-400 shrink-0" />}
                  <div className="flex-1">
                    <span className="font-medium">
                      {tx.type === 'in' ? '+' : tx.type === 'out' ? '-' : '='}{tx.quantity} หน่วย
                    </span>
                    {tx.note && <span className="text-gray-400 ml-2">({tx.note})</span>}
                  </div>
                  <span className="text-gray-400 text-xs">{new Date(tx.created_at).toLocaleString('th-TH')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold">{editId ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อวัตถุดิบ *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="เช่น เมล็ดกาแฟ" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">หน่วย</label>
                  <select className="input" value={form.unit}
                    onChange={e => setForm(f => ({...f, unit: e.target.value}))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">จำนวนปัจจุบัน</label>
                  <input className="input" type="number" min="0" value={form.quantity}
                    onChange={e => setForm(f => ({...f, quantity: e.target.value}))} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ขั้นต่ำ (แจ้งเตือน)</label>
                  <input className="input" type="number" min="0" value={form.min_quantity}
                    onChange={e => setForm(f => ({...f, min_quantity: e.target.value}))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ราคา/หน่วย (บาท)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.cost_per_unit}
                    onChange={e => setForm(f => ({...f, cost_per_unit: e.target.value}))} placeholder="0.00" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={saveItem} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold">
                {adjModal.type === 'in'     && '📦 รับวัตถุดิบเข้า'}
                {adjModal.type === 'out'    && '📤 ตัดสต็อก'}
                {adjModal.type === 'adjust' && '✏️ ปรับสต็อก'}
              </h2>
              <button onClick={() => setAdjModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                <strong>{adjModal.item.name}</strong> — คงเหลือ {Number(adjModal.item.quantity).toLocaleString()} {adjModal.item.unit}
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {adjModal.type === 'adjust' ? 'จำนวนใหม่' : 'จำนวน'} ({adjModal.item.unit})
                </label>
                <input className="input text-lg font-bold" type="number" min="0" step="0.1"
                  value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="0" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
                <input className="input" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="ไม่บังคับ" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-4">
              <button onClick={() => setAdjModal(null)} className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={saveAdj} disabled={saving} className="btn-primary flex-1">
                {saving ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
