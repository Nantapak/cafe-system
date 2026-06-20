import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { printReceipt } from '../lib/printUtils'
import { generatePromptPayPayload, generateQRImageURL, PROMPTPAY_ID } from '../lib/promptpay'
import { useAuth } from '../contexts/AuthContext'
import {
  ShoppingCart, Plus, Minus, Trash2,
  CheckCircle, RotateCcw, X, Printer,
  UserCircle2, Phone, Star, Gift, Coffee,
} from 'lucide-react'

const SUGAR_OPTIONS = ['ไม่หวาน', 'หวาน 50%', 'หวานน้อย', 'หวานปกติ', 'เพิ่มหวาน']

const EMOJI = (catName = '') => {
  if (catName.includes('กาแฟ')) return '☕'
  if (catName.includes('ชา'))   return '🍵'
  if (catName.includes('ขนม'))  return '🍰'
  return '🥤'
}

export default function POS() {
  const { user } = useAuth()
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
  const [costInfo,   setCostInfo]   = useState({ perCup: null, breakdown: [] })

  const [customer,      setCustomer]      = useState(null)
  const [custPhone,     setCustPhone]     = useState('')
  const [custLoading,   setCustLoading]   = useState(false)
  const [pointsRedeem,  setPointsRedeem]  = useState(false)
  const [suggestions,   setSuggestions]   = useState([])

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

  const filtered = activeCat ? products.filter(p => p.category_id === activeCat) : products

  const removeItem  = (cartKey) => setCart(c => c.filter(i => i.cartKey !== cartKey))
  const clearCart   = () => setCart([])
  const updateQty   = (cartKey, delta) =>
    setCart(c => c.map(i =>
      i.cartKey === cartKey ? { ...i, qty: Math.max(1, i.qty + delta) } : i
    ))

  const total          = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalItems     = cart.reduce((s, i) => s + i.qty, 0)
  const cupsInOrder    = cart.reduce((s, i) => s + i.qty, 0)
  const cheapestPrice  = cart.length ? Math.min(...cart.map(i => i.price)) : 0
  const redeemDiscount = (pointsRedeem && customer?.points >= 10) ? cheapestPrice : 0
  const orderTotal     = Math.max(0, total - redeemDiscount)

  const onPhoneChange = async (val) => {
    setCustPhone(val)
    const digits = val.replace(/\D/g, '')
    if (digits.length < 3) { setSuggestions([]); return }
    const { data } = await supabase
      .from('customers').select('id, name, phone, points').ilike('phone', `%${digits}%`).limit(5)
    setSuggestions(data || [])
  }

  const selectSuggestion = (cust) => {
    setCustomer(cust); setCustPhone(cust.phone); setSuggestions([]); setPointsRedeem(false)
  }

  const searchCustomer = async () => {
    const phone = custPhone.trim().replace(/\D/g, '')
    if (!phone) return
    setSuggestions([])
    setCustLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('phone', phone).single()
    setCustLoading(false)
    if (data) { setCustomer(data); setPointsRedeem(false) }
    else alert('ไม่พบสมาชิกเบอร์นี้ในระบบ')
  }

  const clearCustomer = () => {
    setCustomer(null); setCustPhone(''); setPointsRedeem(false); setSuggestions([])
  }

  const openCustomize = (product) => {
    const sizes = allSizes.filter(s => s.product_id === product.id)
    setCostInfo({ perCup: null, breakdown: [] })
    setCustomize({ product, sizes, selectedSizeId: sizes[0]?.id ?? null, sugarLevel: 'หวานปกติ', customNote: '', qty: 1 })
  }

  useEffect(() => {
    if (!customize?.product?.id) return
    let cancelled = false
    const fetchCost = async () => {
      const { data: ings } = await supabase
        .from('product_ingredients')
        .select('quantity, size_id, inventory_id, inventory(name, unit, cost_per_unit)')
        .eq('product_id', customize.product.id)
      if (cancelled) return
      if (!ings?.length) { setCostInfo({ perCup: null, breakdown: [] }); return }
      const sizeId = customize.selectedSizeId
      const sizeSpecific = ings.filter(r => r.size_id === sizeId)
      const general      = ings.filter(r => !r.size_id)
      const combined = [...sizeSpecific]
      general.forEach(g => {
        if (!combined.find(x => x.inventory_id === g.inventory_id)) combined.push(g)
      })
      const perCup = combined.reduce((sum, ing) =>
        sum + Number(ing.quantity) * Number(ing.inventory?.cost_per_unit || 0), 0)
      setCostInfo({ perCup, breakdown: combined })
    }
    fetchCost()
    return () => { cancelled = true }
  }, [customize?.product?.id, customize?.selectedSizeId])

  const currentPrice = () => {
    if (!customize) return 0
    if (customize.selectedSizeId) {
      const sz = customize.sizes.find(s => s.id === customize.selectedSizeId)
      return sz ? Number(sz.price) : Number(customize.product.price)
    }
    return Number(customize.product.price)
  }

  const confirmAdd = () => {
    if (!customize) return
    const sz = customize.sizes.find(s => s.id === customize.selectedSizeId)
    const noteParts = [customize.sugarLevel, customize.customNote.trim() || null].filter(Boolean)
    const note = noteParts.join(' | ') || null
    const newItem = {
      cartKey: Date.now() + Math.random(),
      id: customize.product.id,
      name: customize.product.name,
      price: currentPrice(),
      qty: customize.qty,
      sizeId: customize.selectedSizeId,
      sizeName: sz?.name ?? null,
      note,
      categoryName: customize.product.categories?.name ?? '',
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === newItem.id && i.sizeId === newItem.sizeId && i.note === newItem.note)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + newItem.qty }
        return next
      }
      return [...prev, newItem]
    })
    setCustomize(null)
  }

  const submitOrder = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const cashierName = user?.user_metadata?.name || user?.user_metadata?.username || 'ไม่ทราบ'
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          total: orderTotal, discount: redeemDiscount, status: 'pending',
          cashier_id: user?.id || null, cashier_name: cashierName,
          customer_id: customer?.id || null,
          points_earned: customer ? cupsInOrder : 0,
          points_redeemed: customer && pointsRedeem ? 10 : 0,
        }).select().single()
      if (oErr) throw oErr

      const { error: iErr } = await supabase.from('order_items').insert(
        cart.map(i => ({
          order_id: order.id,
          product_id: i.id,
          name: i.sizeName ? `${i.name} (${i.sizeName})` : i.name,
          price: i.price, quantity: i.qty, note: i.note || null,
        }))
      )
      if (iErr) throw iErr

      const productIds = [...new Set(cart.map(i => i.id))]
      const { data: ingRows } = await supabase
        .from('product_ingredients').select('product_id, inventory_id, quantity, size_id')
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
          const { data: invRows } = await supabase.from('inventory').select('id, quantity').in('id', invIds)
          await Promise.all([
            ...invRows.map(inv =>
              supabase.from('inventory')
                .update({ quantity: Math.max(0, Number(inv.quantity) - deductMap[inv.id]) })
                .eq('id', inv.id)
            ),
            supabase.from('inventory_transactions').insert(
              invRows.map(inv => ({
                inventory_id: inv.id, type: 'out', quantity: deductMap[inv.id],
                note: `ออเดอร์ #${order.order_number}`,
              }))
            ),
          ])
        }
      }

      if (customer) {
        const pointsUsed = pointsRedeem ? 10 : 0
        const newPoints  = Math.max(0, customer.points + cupsInOrder - pointsUsed)
        await supabase.from('customers').update({
          points: newPoints, total_cups: customer.total_cups + cupsInOrder,
        }).eq('id', customer.id)
        await supabase.from('point_transactions').insert({
          customer_id: customer.id, order_id: order.id,
          points_change: cupsInOrder - pointsUsed,
          type: pointsUsed > 0 ? 'redeem' : 'earn',
          note: `ออเดอร์ #${order.order_number} (+${cupsInOrder} แต้ม${pointsUsed > 0 ? ` แลก -${pointsUsed} แต้ม` : ''})`,
        })
      }

      const printItems = cart.map(i => ({
        name: i.name, size_name: i.sizeName || null, note: i.note || null, quantity: i.qty, price: i.price,
      }))
      const orderForPrint  = { ...order, total: orderTotal }
      const memberForPrint = customer ? {
        id: customer.id,
        points: Math.max(0, customer.points + cupsInOrder - (pointsRedeem ? 10 : 0)),
        pointsEarned: cupsInOrder, pointsUsed: pointsRedeem ? 10 : 0,
      } : null
      setLastOrder({ order: orderForPrint, items: printItems })
      printReceipt(orderForPrint, printItems, memberForPrint)

      setSuccess(`ออเดอร์ #${order.order_number} สำเร็จ!`)
      clearCart(); clearCustomer()
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSubmitting(false)
      setTimeout(() => { setSuccess(null); setLastOrder(null) }, 30000)
    }
  }

  const submitAndClose = async () => { await submitOrder(); setCartOpen(false) }

  /* ══════════════════════════════════════════
     CustomerSection
  ══════════════════════════════════════════ */
  const CustomerSection = () => (
    <div className="px-4 py-3 border-t border-coffee-100 bg-amber-50/40">
      <p className="text-xs font-bold text-amber-700 mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
        <Star size={11} className="text-amber-500" /> สมาชิก
      </p>

      {!customer ? (
        <div className="relative">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white border border-amber-200/80 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-amber-300/40 focus-within:border-amber-400 transition-all">
              <Phone size={13} className="text-amber-400 shrink-0" />
              <input
                type="tel" placeholder="เบอร์โทรสมาชิก..."
                value={custPhone} onChange={e => onPhoneChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchCustomer() }}
                className="flex-1 text-sm outline-none bg-transparent placeholder-amber-300 text-gray-700"
              />
            </div>
            <button onClick={searchCustomer} disabled={custLoading || !custPhone.trim()}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors shadow-sm">
              {custLoading ? '...' : 'ค้นหา'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-amber-100 rounded-2xl shadow-xl z-50 overflow-hidden">
              {suggestions.map(s => (
                <button key={s.id} onMouseDown={() => selectSuggestion(s)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors text-left border-b border-amber-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.phone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{'*'.repeat(s.name.length - 1) + s.name.slice(-1)}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">
                    ⭐ {s.points}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-amber-200/60 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-amber-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <UserCircle2 size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{customer.name}</p>
                <p className="text-xs text-gray-400">{customer.phone}</p>
              </div>
            </div>
            <button onClick={clearCustomer} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <X size={13} className="text-gray-400" />
            </button>
          </div>

          <div className="px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star size={12} className="text-amber-400" />
                <span className="text-xs text-gray-500">แต้มสะสม</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-amber-600">{customer.points}</span>
                <span className="text-xs text-gray-400">/ 10 แต้ม</span>
              </div>
            </div>

            {cupsInOrder > 0 && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
                <span>ออเดอร์นี้ +{cupsInOrder} แต้ม</span>
                <span className="font-semibold text-amber-600">
                  → {Math.max(0, customer.points + cupsInOrder - (pointsRedeem ? 10 : 0))} แต้ม
                </span>
              </div>
            )}

            {customer.points >= 10 && cart.length > 0 && (
              <button onClick={() => setPointsRedeem(r => !r)}
                className={`mt-2.5 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all
                  ${pointsRedeem
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                <Gift size={12} />
                {pointsRedeem
                  ? `✓ แลก 10 แต้ม — ลด ฿${cheapestPrice.toLocaleString()}`
                  : 'แลก 10 แต้ม รับ 1 แก้วฟรี'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Coffee size={36} className="text-coffee-300 animate-pulse" />
      <p className="text-coffee-400 text-sm font-medium">กำลังโหลดเมนู...</p>
    </div>
  )

  /* ══════════════════════════════════════════
     CartItems
  ══════════════════════════════════════════ */
  const CartItems = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center py-8">
          <div className="w-14 h-14 rounded-full bg-coffee-50 flex items-center justify-center mb-3">
            <ShoppingCart size={24} className="text-coffee-300" />
          </div>
          <p className="text-sm text-gray-400">ยังไม่มีรายการ</p>
          <p className="text-xs text-gray-300 mt-0.5">เลือกเมนูเพื่อเริ่มออเดอร์</p>
        </div>
      ) : cart.map(item => (
        <div key={item.cartKey}
          className="group bg-coffee-50/60 hover:bg-coffee-100/60 rounded-xl p-3 transition-colors">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                {item.sizeName && (
                  <span className="text-[10px] bg-coffee-200/60 text-coffee-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">
                    {item.sizeName}
                  </span>
                )}
              </div>
              {item.note && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.note}</p>
              )}
              <p className="text-coffee-600 text-sm font-black mt-1">
                ฿{(item.price * item.qty).toLocaleString()}
                {item.qty > 1 && (
                  <span className="text-gray-400 font-normal text-xs ml-1">
                    ({item.qty} × ฿{item.price.toLocaleString()})
                  </span>
                )}
              </p>
            </div>
            <button onClick={() => removeItem(item.cartKey)}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full hover:bg-red-100 flex items-center justify-center transition-all shrink-0">
              <Trash2 size={12} className="text-red-400" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <button onClick={() => updateQty(item.cartKey, -1)}
              className="w-7 h-7 rounded-full bg-white border border-coffee-200 flex items-center justify-center hover:bg-coffee-100 transition-colors shadow-sm">
              <Minus size={11} />
            </button>
            <span className="text-sm font-black w-6 text-center text-gray-800">{item.qty}</span>
            <button onClick={() => updateQty(item.cartKey, 1)}
              className="w-7 h-7 rounded-full bg-coffee-600 text-white flex items-center justify-center hover:bg-coffee-700 transition-colors shadow-sm">
              <Plus size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  /* ══════════════════════════════════════════
     SuccessBanner
  ══════════════════════════════════════════ */
  const SuccessBanner = () => {
    if (!success) return null
    let qrImgUrl = null
    if (lastOrder && PROMPTPAY_ID) {
      try {
        const payload = generatePromptPayPayload(PROMPTPAY_ID, Number(lastOrder.order.total))
        qrImgUrl = generateQRImageURL(payload, 240)
      } catch (_) {}
    }

    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-emerald-200 shadow-sm">
        <div className="bg-emerald-500 px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} className="text-white" />
          <p className="text-sm font-bold text-white">{success}</p>
        </div>

        {qrImgUrl && lastOrder && (
          <div className="bg-white px-4 py-4 flex flex-col items-center">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">สแกน PromptPay ชำระเงิน</p>
            <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100">
              <img src={qrImgUrl} alt="QR PromptPay" className="w-36 h-36 block" />
            </div>
            <p className="mt-3 text-2xl font-black text-gray-800">
              ฿{Number(lastOrder.order.total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {lastOrder && (
          <div className="bg-gray-50 px-4 py-2.5 flex justify-center border-t border-gray-100">
            <button onClick={() => printReceipt(lastOrder.order, lastOrder.items)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                         bg-white text-coffee-700 border border-coffee-200 hover:bg-coffee-50 transition-colors shadow-sm">
              <Printer size={12} /> ปริ้นใบเสร็จ
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ══════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════ */
  return (
    <div className="flex gap-5 h-[calc(100vh-4rem)] md:h-[calc(100vh-3rem)]">

      {/* ══════════ LEFT: เมนู ══════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-lg font-black text-coffee-800 tracking-tight">POS แคชเชียร์</h1>
            <p className="text-xs text-coffee-400 mt-0.5">{filtered.length} รายการ</p>
          </div>
          {totalItems > 0 && (
            <div className="md:hidden flex items-center gap-1.5 bg-coffee-600 text-white rounded-full px-3 py-1 text-xs font-bold">
              <ShoppingCart size={12} />
              {totalItems} รายการ
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 shrink-0 scrollbar-hide">
          {[{ id: null, name: 'ทั้งหมด' }, ...categories].map(c => (
            <button key={c.id ?? 'all'} onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all
                ${activeCat === c.id
                  ? 'bg-coffee-600 text-white shadow-md shadow-coffee-600/20'
                  : 'bg-white border border-coffee-200 text-coffee-600 hover:border-coffee-400 hover:bg-coffee-50'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-24 md:pb-0">
          {filtered.map(p => {
            const sizes   = allSizes.filter(s => s.product_id === p.id)
            const cartQty = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0)
            const minPrice = sizes.length ? Math.min(...sizes.map(s => Number(s.price))) : Number(p.price)

            return (
              <button key={p.id} onClick={() => openCustomize(p)}
                className="group relative bg-white rounded-2xl border border-coffee-100 text-left
                           hover:border-coffee-300 hover:shadow-lg hover:shadow-coffee-600/8
                           hover:-translate-y-0.5 active:scale-[0.98]
                           transition-all duration-200 overflow-hidden">

                {/* รูปภาพ */}
                <div className="w-full aspect-square bg-coffee-50 overflow-hidden relative">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl">{EMOJI(p.categories?.name)}</span>
                      </div>
                  }

                  {/* Badge in cart */}
                  {cartQty > 0 && (
                    <div className="absolute top-2 right-2 bg-coffee-600 text-white text-xs font-black
                                    w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                      {cartQty}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">{p.name}</p>

                  {sizes.length > 0 ? (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {sizes.map(s => (
                        <span key={s.id} className="text-[10px] bg-coffee-50 text-coffee-500 border border-coffee-100 px-1.5 py-0.5 rounded-md font-semibold">
                          {s.name} ฿{Number(s.price).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-coffee-600 font-black text-sm mt-1">฿{Number(p.price).toLocaleString()}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ══════════ RIGHT: ตะกร้า desktop ══════════ */}
      <div className="hidden md:flex w-80 flex-col shrink-0">
        <div className="card flex-1 flex flex-col overflow-hidden">

          {/* Cart Header */}
          <div className="px-4 py-3.5 border-b border-coffee-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-coffee-100 flex items-center justify-center">
                <ShoppingCart size={15} className="text-coffee-600" />
              </div>
              <span className="font-black text-gray-800">รายการ</span>
              {totalItems > 0 && (
                <span className="bg-coffee-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-black">
                  {totalItems}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart}
                className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group">
                <RotateCcw size={14} className="text-gray-400 group-hover:text-red-400 transition-colors" />
              </button>
            )}
          </div>

          <CartItems />
          <CustomerSection />

          {/* Total + Checkout */}
          <div className="px-4 py-4 border-t border-coffee-100 space-y-3 bg-white">
            {redeemDiscount > 0 && (
              <div className="flex justify-between items-center bg-emerald-50 rounded-xl px-3 py-2">
                <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                  <Gift size={13} /> ส่วนลดแต้ม
                </span>
                <span className="font-bold text-emerald-600">-฿{redeemDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium text-sm">ยอดรวม</span>
              <div className="text-right">
                {redeemDiscount > 0 && (
                  <p className="text-xs text-gray-300 line-through text-right">฿{total.toLocaleString()}</p>
                )}
                <span className="text-2xl font-black text-coffee-700">฿{orderTotal.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={submitOrder} disabled={!cart.length || submitting}
              className="w-full py-3.5 rounded-2xl bg-coffee-600 hover:bg-coffee-700 active:bg-coffee-800
                         text-white font-black text-base flex items-center justify-center gap-2
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all shadow-lg shadow-coffee-600/25 hover:shadow-coffee-600/40">
              {submitting
                ? <><span className="animate-spin">⏳</span> กำลังบันทึก...</>
                : <><CheckCircle size={18} /> ยืนยันออเดอร์</>
              }
            </button>
          </div>
        </div>
        <SuccessBanner />
      </div>

      {/* ══════════ ปุ่มลอย มือถือ ══════════ */}
      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 bg-coffee-600 text-white
                     rounded-2xl shadow-2xl shadow-coffee-600/40 px-4 py-3.5
                     flex items-center gap-3 active:scale-95 transition-transform">
          <ShoppingCart size={20} />
          <div className="text-left">
            <p className="text-xs opacity-70 leading-none">{totalItems} รายการ</p>
            <p className="font-black text-base leading-tight">฿{orderTotal.toLocaleString()}</p>
          </div>
          <div className="bg-white/20 rounded-xl px-2.5 py-1 text-xs font-bold">ดู</div>
        </button>
      )}

      {/* ══════════ Cart Bottom Sheet มือถือ ══════════ */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-4 py-3 border-b border-coffee-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-coffee-100 flex items-center justify-center">
                  <ShoppingCart size={15} className="text-coffee-600" />
                </div>
                <span className="font-black text-gray-800">รายการสั่ง</span>
                <span className="bg-coffee-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-black">
                  {totalItems}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <button onClick={clearCart}
                    className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors">
                    <RotateCcw size={15} className="text-gray-400" />
                  </button>
                )}
                <button onClick={() => setCartOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>

            <CartItems />
            <CustomerSection />

            <div className="px-4 pt-3 pb-4 border-t border-coffee-100 space-y-3 bg-white shrink-0"
                 style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
              {redeemDiscount > 0 && (
                <div className="flex justify-between items-center bg-emerald-50 rounded-xl px-3 py-2">
                  <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                    <Gift size={13} /> ส่วนลดแต้ม
                  </span>
                  <span className="font-bold text-emerald-600">-฿{redeemDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium text-sm">ยอดรวม</span>
                <div className="text-right">
                  {redeemDiscount > 0 && (
                    <p className="text-xs text-gray-300 line-through">฿{total.toLocaleString()}</p>
                  )}
                  <span className="text-2xl font-black text-coffee-700">฿{orderTotal.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={submitAndClose} disabled={!cart.length || submitting}
                className="w-full py-3.5 rounded-2xl bg-coffee-600 hover:bg-coffee-700
                           text-white font-black text-base flex items-center justify-center gap-2
                           disabled:opacity-40 transition-all shadow-lg shadow-coffee-600/25">
                {submitting
                  ? <><span className="animate-spin">⏳</span> กำลังบันทึก...</>
                  : <><CheckCircle size={18} /> ยืนยันออเดอร์</>
                }
              </button>
              <SuccessBanner />
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Customize Modal ══════════ */}
      {customize && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-3xl sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col rounded-t-3xl">

            {/* Modal Header */}
            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-coffee-50 flex items-center justify-center shrink-0 text-2xl">
                  {EMOJI(customize.product.categories?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-gray-800 text-lg leading-tight">{customize.product.name}</h2>
                  <p className="text-coffee-600 font-black text-xl mt-0.5">
                    ฿{(currentPrice() * customize.qty).toLocaleString()}
                    {customize.qty > 1 && (
                      <span className="text-gray-400 font-normal text-sm ml-1.5">
                        ฿{currentPrice().toLocaleString()} × {customize.qty}
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={() => setCustomize(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
              <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-coffee-200 to-transparent" />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Size */}
              {customize.sizes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">ขนาด</p>
                  <div className="flex gap-2 flex-wrap">
                    {customize.sizes.map(sz => (
                      <button key={sz.id}
                        onClick={() => setCustomize(c => ({ ...c, selectedSizeId: sz.id }))}
                        className={`px-4 py-2.5 rounded-2xl border-2 text-sm font-bold transition-all
                          ${customize.selectedSizeId === sz.id
                            ? 'border-coffee-600 bg-coffee-600 text-white shadow-md shadow-coffee-600/20'
                            : 'border-coffee-200 text-coffee-600 bg-white hover:border-coffee-400 hover:bg-coffee-50'}`}>
                        {sz.name}
                        <span className={`ml-1.5 text-xs font-semibold ${customize.selectedSizeId === sz.id ? 'opacity-80' : 'opacity-60'}`}>
                          ฿{Number(sz.price).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ระดับความหวาน */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">🍬 ระดับความหวาน</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGAR_OPTIONS.map((opt, i) => (
                    <button key={opt}
                      onClick={() => setCustomize(c => ({ ...c, sugarLevel: opt }))}
                      className={`px-3 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all
                        ${SUGAR_OPTIONS.length % 2 !== 0 && i === SUGAR_OPTIONS.length - 1 ? 'col-span-2' : ''}
                        ${customize.sugarLevel === opt
                          ? 'border-coffee-600 bg-coffee-600 text-white shadow-md shadow-coffee-600/20'
                          : 'border-coffee-200 text-coffee-600 bg-white hover:border-coffee-400 hover:bg-coffee-50'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* สูตร */}
              {costInfo.breakdown.length > 0 && (
                <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2.5">🧾 สูตรบาริสต้า</p>
                  <div className="space-y-1.5">
                    {costInfo.breakdown.map((ing, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-purple-600">{ing.inventory?.name}</span>
                        <span className="font-bold text-purple-700">{ing.quantity} {ing.inventory?.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* หมายเหตุ */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">หมายเหตุพิเศษ</p>
                <input type="text" value={customize.customNote}
                  onChange={e => setCustomize(c => ({ ...c, customNote: e.target.value }))}
                  placeholder="เช่น ไม่ใส่น้ำแข็ง, เพิ่มช็อต..."
                  className="w-full border-2 border-coffee-200 rounded-2xl px-4 py-2.5 text-sm
                             bg-white focus:outline-none focus:border-coffee-500 focus:ring-2 focus:ring-coffee-500/10
                             placeholder-coffee-300 text-gray-700 transition-all" />
              </div>

              {/* จำนวน */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">จำนวน</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => setCustomize(c => ({ ...c, qty: Math.max(1, c.qty - 1) }))}
                    className="w-10 h-10 rounded-full bg-coffee-50 border-2 border-coffee-200
                               flex items-center justify-center hover:bg-coffee-100 hover:border-coffee-400 transition-all">
                    <Minus size={16} className="text-coffee-600" />
                  </button>
                  <span className="text-2xl font-black w-10 text-center text-gray-800">{customize.qty}</span>
                  <button onClick={() => setCustomize(c => ({ ...c, qty: c.qty + 1 }))}
                    className="w-10 h-10 rounded-full bg-coffee-600 text-white
                               flex items-center justify-center hover:bg-coffee-700 transition-colors shadow-md shadow-coffee-600/30">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Add to cart */}
            <div className="px-5 pb-5 pt-3 border-t border-coffee-100">
              <button onClick={confirmAdd}
                className="w-full py-4 rounded-2xl bg-coffee-600 hover:bg-coffee-700
                           text-white font-black text-base flex items-center justify-center gap-2
                           transition-all shadow-xl shadow-coffee-600/30 hover:shadow-coffee-600/40">
                <Plus size={18} /> เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
