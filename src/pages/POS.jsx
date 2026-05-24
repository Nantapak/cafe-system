import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { printReceipt } from '../lib/printUtils'
import {
  ShoppingCart, Plus, Minus, Trash2,
  CheckCircle, RotateCcw, X, Printer,
} from 'lucide-react'

const NOTE_GROUPS = [
  {
    label: '🍬 น้ำตาล',
    options: ['ไม่ใส่น้ำตาล', 'น้ำตาลน้อย', 'น้ำตาลมาก', 'เปลี่ยนเป็นน้ำตาลหลอด'],
  },
  {
    label: '🧊 น้ำแข็ง',
    options: ['ไม่ใส่น้ำแข็ง', 'น้ำแข็งน้อย', 'น้ำแข็งเพิ่ม'],
  },
  {
    label: '✨ เพิ่มเติม',
    options: ['เพิ่มช็อต', 'ใส่วิปครีม', 'ไม่ใส่นม', 'เปลี่ยนเป็นโอ๊ตมิลค์', 'ใส่นมข้นหวาน'],
  },
]

const EMOJI = (catName = '') => {
  if (catName.includes('กาแฟ')) return '☕'
  if (catName.includes('ชา'))   return '🍵'
  if (catName.includes('ขนม'))  return '🍰'
  return '🥤'
}

export default function POS() {
  const [categories, setCategories] = useState([])
  const [products,   setProducts]   = useState([])
  const [allSizes,   setAllSizes]   = useState([])
  const [activeCat,  setActiveCat]  = useState(null)
  const [cart,       setCart]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState(null)
  const [lastOrder,  setLastOrder]  = useState(null)
  const [customize,  setCustomize]  = useState(null)
  const [cartOpen,   setCartOpen]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: sizes }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('*, categories(name)').eq('is_available', true).order('name'),
      supabase.from('product_sizes').select('*').order('sort_order'),
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    setAllSizes(sizes || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = activeCat
    ? products.filter(p => p.category_id === activeCat)
    : products

  /* ── Cart operations ── */
  const removeItem  = (cartKey) => setCart(c => c.filter(i => i.cartKey !== cartKey))
  const clearCart   = () => setCart([])
  const updateQty   = (cartKey, delta) =>
    setCart(c => c.map(i =>
      i.cartKey === cartKey
        ? { ...i, qty: Math.max(1, i.qty + delta) }
        : i
    ))

  const total      = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalItems = cart.reduce((s, i) => s + i.qty, 0)

  /* ── Customize modal ── */
  const openCustomize = (product) => {
    const sizes = allSizes.filter(s => s.product_id === product.id)
    setCustomize({
      product,
      sizes,
      selectedSizeId: sizes[0]?.id ?? null,
      selectedNotes: [],
      customNote: '',
      qty: 1,
    })
  }

  const currentPrice = () => {
    if (!customize) return 0
    if (customize.selectedSizeId) {
      const sz = customize.sizes.find(s => s.id === customize.selectedSizeId)
      return sz ? Number(sz.price) : Number(customize.product.price)
    }
    return Number(customize.product.price)
  }

  const toggleNote = (note) =>
    setCustomize(c => ({
      ...c,
      selectedNotes: c.selectedNotes.includes(note)
        ? c.selectedNotes.filter(n => n !== note)
        : [...c.selectedNotes, note],
    }))

  const confirmAdd = () => {
    if (!customize) return
    const sz       = customize.sizes.find(s => s.id === customize.selectedSizeId)
    const allNotes = [
      ...customize.selectedNotes,
      ...(customize.customNote.trim() ? [customize.customNote.trim()] : []),
    ]
    const note = allNotes.join(', ') || null

    const newItem = {
      cartKey:      Date.now() + Math.random(),
      id:           customize.product.id,
      name:         customize.product.name,
      price:        currentPrice(),
      qty:          customize.qty,
      sizeId:       customize.selectedSizeId,
      sizeName:     sz?.name ?? null,
      note,
      categoryName: customize.product.categories?.name ?? '',
    }

    // รวมกับ item เดิมถ้า product + size + note ตรงกัน
    setCart(prev => {
      const idx = prev.findIndex(
        i => i.id === newItem.id && i.sizeId === newItem.sizeId && i.note === newItem.note
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + newItem.qty }
        return next
      }
      return [...prev, newItem]
    })
    setCustomize(null)
  }

  /* ── Submit order + ตัดสต็อก ── */
  const submitOrder = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({ total, status: 'pending' })
        .select().single()
      if (oErr) throw oErr

      const { error: iErr } = await supabase.from('order_items').insert(
        cart.map(i => ({
          order_id:   order.id,
          product_id: i.id,
          name:       i.sizeName ? `${i.name} (${i.sizeName})` : i.name,
          price:      i.price,
          quantity:   i.qty,
          note:       i.note || null,
        }))
      )
      if (iErr) throw iErr

      // ตัดสต็อก
      const productIds = [...new Set(cart.map(i => i.id))]
      const { data: ingRows } = await supabase
        .from('product_ingredients')
        .select('product_id, inventory_id, quantity, size_id')
        .in('product_id', productIds)

      if (ingRows?.length) {
        const deductMap = {}
        for (const item of cart) {
          let ings = ingRows.filter(r => r.product_id === item.id && r.size_id === item.sizeId)
          if (!ings.length) ings = ingRows.filter(r => r.product_id === item.id && !r.size_id)
          const general  = ingRows.filter(r => r.product_id === item.id && !r.size_id)
          const toDeduct = item.sizeId
            ? ings.concat(general.filter(g => !ings.find(x => x.inventory_id === g.inventory_id)))
            : ings
          for (const ing of toDeduct) {
            deductMap[ing.inventory_id] = (deductMap[ing.inventory_id] || 0) + Number(ing.quantity) * item.qty
          }
        }

        const invIds = Object.keys(deductMap)
        if (invIds.length) {
          const { data: invRows } = await supabase
            .from('inventory').select('id, quantity').in('id', invIds)
          await Promise.all([
            ...invRows.map(inv =>
              supabase.from('inventory')
                .update({ quantity: Math.max(0, Number(inv.quantity) - deductMap[inv.id]) })
                .eq('id', inv.id)
            ),
            supabase.from('inventory_transactions').insert(
              invRows.map(inv => ({
                inventory_id: inv.id,
                type:         'out',
                quantity:     deductMap[inv.id],
                note:         `ออเดอร์ #${order.order_number}`,
              }))
            ),
          ])
        }
      }

      // ปริ้นอัตโนมัติ
      const printItems = cart.map(i => ({
        name:      i.name,
        size_name: i.sizeName || null,
        note:      i.note     || null,
        quantity:  i.qty,
        price:     i.price,
      }))
      setLastOrder({ order, items: printItems })
      printReceipt(order, printItems)

      setSuccess(`ออเดอร์ #${order.order_number} สำเร็จ! ยอด ฿${total.toLocaleString()}`)
      clearCart()
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSubmitting(false)
      setTimeout(() => { setSuccess(null); setLastOrder(null) }, 30000)
    }
  }

  const submitAndClose = async () => {
    await submitOrder()
    setCartOpen(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-coffee-600 text-lg">กำลังโหลด... ☕</div>
  )

  /* ── Cart panel (shared UI) ── */
  const CartItems = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {cart.length === 0 ? (
        <div className="text-center text-gray-400 mt-12">
          <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">ยังไม่มีสินค้าในตะกร้า</p>
        </div>
      ) : cart.map(item => (
        <div key={item.cartKey} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                {item.sizeName && (
                  <span className="text-xs bg-coffee-100 text-coffee-600 px-1.5 py-0.5 rounded font-semibold">
                    {item.sizeName}
                  </span>
                )}
              </div>
              {item.note && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.note}</p>}
              <p className="text-coffee-600 text-sm font-bold mt-0.5">
                ฿{(item.price * item.qty).toLocaleString()}
              </p>
            </div>
            <button onClick={() => removeItem(item.cartKey)} className="text-gray-300 hover:text-red-400 shrink-0 mt-0.5">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => updateQty(item.cartKey, -1)}
              className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
              <Minus size={12} />
            </button>
            <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
            <button onClick={() => updateQty(item.cartKey, 1)}
              className="w-7 h-7 rounded-full bg-coffee-600 text-white flex items-center justify-center hover:bg-coffee-700">
              <Plus size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  const SuccessBanner = () => success ? (
    <div className="mt-3 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
      <p className="font-medium text-center mb-2">✅ {success}</p>
      {lastOrder && (
        <div className="flex justify-center">
          <button
            onClick={() => printReceipt(lastOrder.order, lastOrder.items)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium
                       bg-coffee-100 text-coffee-800 border border-coffee-300 hover:bg-coffee-200 transition-colors"
          >
            <Printer size={13} /> ปริ้นใบเสร็จ
          </button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="flex gap-5 h-[calc(100vh-4rem)] md:h-[calc(100vh-3rem)]">

      {/* ════════════ เมนู ════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        <h1 className="text-xl font-bold text-gray-800 mb-4">POS / แคชเชียร์</h1>

        {/* หมวดหมู่ */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 shrink-0">
          <button onClick={() => setActiveCat(null)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${!activeCat ? 'bg-coffee-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >ทั้งหมด</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${activeCat === c.id ? 'bg-coffee-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >{c.name}</button>
          ))}
        </div>

        {/* กริดสินค้า */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-24 md:pb-0">
          {filtered.map(p => {
            const sizes   = allSizes.filter(s => s.product_id === p.id)
            const cartQty = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0)
            return (
              <button key={p.id} onClick={() => openCustomize(p)}
                className="card p-4 text-left hover:shadow-md hover:border-coffee-300 transition-all active:scale-95"
              >
                <div className="text-3xl mb-2">{EMOJI(p.categories?.name)}</div>
                <p className="font-semibold text-gray-800 text-sm leading-tight">{p.name}</p>
                {sizes.length > 0 ? (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {sizes.map(s => (
                      <span key={s.id} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                        {s.name} ฿{Number(s.price).toLocaleString()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-coffee-600 font-bold mt-1">฿{Number(p.price).toLocaleString()}</p>
                )}
                {cartQty > 0 && (
                  <div className="mt-2">
                    <span className="text-xs bg-coffee-100 text-coffee-700 px-2 py-0.5 rounded-full font-medium">
                      x{cartQty} ในตะกร้า
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ════════════ ตะกร้า — desktop/tablet ════════════ */}
      <div className="hidden md:flex w-80 flex-col shrink-0">
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-coffee-600" />
              <span className="font-bold text-gray-800">ตะกร้า</span>
              {totalItems > 0 && (
                <span className="bg-coffee-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-gray-400 hover:text-red-500 transition-colors">
                <RotateCcw size={16} />
              </button>
            )}
          </div>

          <CartItems />

          <div className="px-4 py-3 border-t border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">รวมทั้งหมด</span>
              <span className="text-xl font-bold text-coffee-700">฿{total.toLocaleString()}</span>
            </div>
            <button onClick={submitOrder} disabled={!cart.length || submitting}
              className="btn-primary w-full text-base py-3 flex items-center justify-center gap-2 disabled:opacity-50">
              <CheckCircle size={18} />
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันออเดอร์'}
            </button>
          </div>
        </div>
        <SuccessBanner />
      </div>

      {/* ════════════ ปุ่มตะกร้าลอย — มือถือ ════════════ */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-30 bg-coffee-600 text-white
                     rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3
                     active:scale-95 transition-transform"
        >
          <ShoppingCart size={20} />
          <div className="text-left">
            <p className="text-xs opacity-80 leading-none">{totalItems} รายการ</p>
            <p className="font-bold text-base leading-tight">฿{total.toLocaleString()}</p>
          </div>
          <div className="bg-white/20 rounded-lg px-2 py-1 text-xs font-semibold">ดูตะกร้า</div>
        </button>
      )}

      {/* ════════════ Cart Bottom Sheet — มือถือ ════════════ */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-coffee-600" />
                <span className="font-bold text-gray-800">ตะกร้า</span>
                <span className="bg-coffee-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-gray-400 hover:text-red-500 p-1">
                    <RotateCcw size={16} />
                  </button>
                )}
                <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            <CartItems />

            <div className="px-4 py-4 border-t border-gray-100 space-y-3 bg-white"
                 style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">รวมทั้งหมด</span>
                <span className="text-2xl font-bold text-coffee-700">฿{total.toLocaleString()}</span>
              </div>
              <button
                onClick={submitAndClose}
                disabled={!cart.length || submitting}
                className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={18} />
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันออเดอร์'}
              </button>
              <SuccessBanner />
            </div>
          </div>
        </div>
      )}

      {/* ════════════ Customize Modal ════════════ */}
      {customize && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col rounded-t-2xl">

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{EMOJI(customize.product.categories?.name)}</span>
                <div>
                  <h2 className="font-bold text-gray-800 text-lg leading-tight">{customize.product.name}</h2>
                  <p className="text-coffee-600 font-semibold text-sm">
                    ฿{(currentPrice() * customize.qty).toLocaleString()}
                    {customize.qty > 1 && (
                      <span className="text-gray-400 font-normal"> (฿{currentPrice().toLocaleString()} × {customize.qty})</span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={() => setCustomize(null)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Size */}
              {customize.sizes.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">ขนาด</p>
                  <div className="flex gap-2 flex-wrap">
                    {customize.sizes.map(sz => (
                      <button
                        key={sz.id}
                        onClick={() => setCustomize(c => ({ ...c, selectedSizeId: sz.id }))}
                        className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                          ${customize.selectedSizeId === sz.id
                            ? 'border-coffee-600 bg-coffee-50 text-coffee-700'
                            : 'border-gray-200 text-gray-600 hover:border-coffee-300'}`}
                      >
                        {sz.name}
                        <span className="ml-1 text-xs opacity-70">฿{Number(sz.price).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {NOTE_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-sm font-semibold text-gray-700 mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => toggleNote(opt)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                          ${customize.selectedNotes.includes(opt)
                            ? 'bg-coffee-600 border-coffee-600 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-coffee-400'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* หมายเหตุเพิ่มเติม */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">หมายเหตุเพิ่มเติม</p>
                <input
                  type="text"
                  value={customize.customNote}
                  onChange={e => setCustomize(c => ({ ...c, customNote: e.target.value }))}
                  placeholder="เช่น ไม่ใส่น้ำแข็ง, หวานน้อยมาก..."
                  className="input w-full text-sm"
                />
              </div>

              {/* จำนวน */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">จำนวน</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCustomize(c => ({ ...c, qty: Math.max(1, c.qty - 1) }))}
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-xl font-bold w-8 text-center">{customize.qty}</span>
                  <button
                    onClick={() => setCustomize(c => ({ ...c, qty: c.qty + 1 }))}
                    className="w-9 h-9 rounded-full bg-coffee-600 text-white flex items-center justify-center hover:bg-coffee-700"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={confirmAdd} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
                <Plus size={18} /> เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
