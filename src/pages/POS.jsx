import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { printReceipt } from '../lib/printUtils'
import { generatePromptPayPayload, generateQRImageURL, PROMPTPAY_ID } from '../lib/promptpay'
import { useAuth } from '../contexts/AuthContext'
import {
  ShoppingCart, Plus, Minus, Trash2,
  CheckCircle, RotateCcw, X, Printer,
  UserCircle2, Phone, Star, Gift,
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

  /* ── สมาชิก ── */
  const [customer,     setCustomer]     = useState(null)   // ข้อมูลสมาชิกที่ค้นพบ
  const [custPhone,    setCustPhone]    = useState('')      // เบอร์โทรที่พิมพ์
  const [custLoading,  setCustLoading]  = useState(false)
  const [pointsRedeem, setPointsRedeem] = useState(false)  // ต้องการแลกแต้มไหม

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

  const total          = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalItems     = cart.reduce((s, i) => s + i.qty, 0)
  const cupsInOrder    = cart.reduce((s, i) => s + i.qty, 0)
  const cheapestPrice  = cart.length ? Math.min(...cart.map(i => i.price)) : 0
  const redeemDiscount = (pointsRedeem && customer?.points >= 10) ? cheapestPrice : 0
  const orderTotal     = Math.max(0, total - redeemDiscount)

  /* ── ค้นหาสมาชิกจากเบอร์โทร ── */
  const searchCustomer = async () => {
    const phone = custPhone.trim().replace(/\D/g, '')
    if (!phone) return
    setCustLoading(true)
    const { data } = await supabase
      .from('customers').select('*').eq('phone', phone).single()
    setCustLoading(false)
    if (data) {
      setCustomer(data)
      setPointsRedeem(false)
    } else {
      alert('ไม่พบสมาชิกเบอร์นี้ในระบบ')
    }
  }

  const clearCustomer = () => {
    setCustomer(null); setCustPhone(''); setPointsRedeem(false)
  }

  /* ── Customize modal ── */
  const openCustomize = (product) => {
    const sizes = allSizes.filter(s => s.product_id === product.id)
    setCostInfo({ perCup: null, breakdown: [] })
    setCustomize({
      product,
      sizes,
      selectedSizeId: sizes[0]?.id ?? null,
      sugarLevel: 'หวานปกติ',
      customNote: '',
      qty: 1,
    })
  }

  /* ── คำนวณต้นทุนต่อแก้ว เมื่อเปิด modal หรือเปลี่ยน size ── */
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
    const noteParts = [
      customize.sugarLevel,
      customize.customNote.trim() || null,
    ].filter(Boolean)
    const note = noteParts.join(' | ') || null

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
      const cashierName = user?.user_metadata?.name || user?.user_metadata?.username || 'ไม่ทราบ'
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          total:            orderTotal,
          discount:         redeemDiscount,
          status:           'pending',
          cashier_id:       user?.id || null,
          cashier_name:     cashierName,
          customer_id:      customer?.id || null,
          points_earned:    customer ? cupsInOrder : 0,
          points_redeemed:  customer && pointsRedeem ? 10 : 0,
        })
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

      // อัปเดตแต้มสมาชิก
      if (customer) {
        const pointsUsed   = pointsRedeem ? 10 : 0
        const newPoints    = Math.max(0, customer.points + cupsInOrder - pointsUsed)
        await supabase.from('customers').update({
          points:     newPoints,
          total_cups: customer.total_cups + cupsInOrder,
        }).eq('id', customer.id)

        await supabase.from('point_transactions').insert({
          customer_id:   customer.id,
          order_id:      order.id,
          points_change: cupsInOrder - pointsUsed,
          type:          pointsUsed > 0 ? 'redeem' : 'earn',
          note: `ออเดอร์ #${order.order_number} (+${cupsInOrder} แต้ม${pointsUsed > 0 ? ` แลก -${pointsUsed} แต้ม` : ''})`,
        })
      }

      // ปริ้นอัตโนมัติ
      const printItems = cart.map(i => ({
        name:      i.name,
        size_name: i.sizeName || null,
        note:      i.note     || null,
        quantity:  i.qty,
        price:     i.price,
      }))
      const orderForPrint = { ...order, total: orderTotal }
      setLastOrder({ order: orderForPrint, items: printItems })
      printReceipt(orderForPrint, printItems)

      setSuccess(`ออเดอร์ #${order.order_number} สำเร็จ! ยอด ฿${orderTotal.toLocaleString()}`)
      clearCart()
      clearCustomer()
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

  /* ── CustomerSection ── */
  const CustomerSection = () => (
    <div className="px-4 py-3 border-t border-gray-100 bg-amber-50/60">
      <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
        <Star size={12} className="text-amber-500" /> สมาชิก
      </p>

      {!customer ? (
        /* ค้นหาสมาชิก */
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5">
            <Phone size={13} className="text-gray-400 shrink-0" />
            <input
              type="tel"
              placeholder="เบอร์โทร..."
              value={custPhone}
              onChange={e => setCustPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchCustomer()}
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
          <button
            onClick={searchCustomer}
            disabled={custLoading || !custPhone.trim()}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            {custLoading ? '...' : 'ค้นหา'}
          </button>
        </div>
      ) : (
        /* แสดงข้อมูลสมาชิก */
        <div className="bg-white rounded-xl p-2.5 border border-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCircle2 size={20} className="text-amber-500" />
              <div>
                <p className="text-sm font-bold text-gray-800">{customer.name}</p>
                <p className="text-xs text-gray-400">{customer.phone}</p>
              </div>
            </div>
            <button onClick={clearCustomer} className="text-gray-300 hover:text-gray-500">
              <X size={15} />
            </button>
          </div>

          {/* แต้มปัจจุบัน */}
          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Star size={13} className="text-amber-400" />
              <span className="text-xs text-gray-600">แต้มสะสม</span>
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-amber-600">{customer.points}</span>
              <span className="text-xs text-gray-400 ml-1">/ 10</span>
            </div>
          </div>

          {/* แต้มที่จะได้จากออเดอร์นี้ */}
          {cupsInOrder > 0 && (
            <p className="text-xs text-center text-gray-400">
              ออเดอร์นี้: +{cupsInOrder} แต้ม
              → เหลือ {Math.max(0, customer.points + cupsInOrder - (pointsRedeem ? 10 : 0))} แต้ม
            </p>
          )}

          {/* ปุ่มแลกแต้ม */}
          {customer.points >= 10 && cart.length > 0 && (
            <button
              onClick={() => setPointsRedeem(r => !r)}
              className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                ${pointsRedeem
                  ? 'bg-green-500 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
            >
              <Gift size={13} />
              {pointsRedeem
                ? `✓ แลก 10 แต้ม — ลด ฿${cheapestPrice.toLocaleString()}`
                : `แลก 10 แต้ม รับ 1 แก้วฟรี`
              }
            </button>
          )}
        </div>
      )}
    </div>
  )

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

  const SuccessBanner = () => {
    if (!success) return null

    /* สร้าง QR URL สำหรับแสดงหน้าจอ (ถ้า PROMPTPAY_ID ตั้งค่าไว้) */
    let qrImgUrl = null
    if (lastOrder && PROMPTPAY_ID) {
      try {
        const payload = generatePromptPayPayload(PROMPTPAY_ID, Number(lastOrder.order.total))
        qrImgUrl = generateQRImageURL(payload, 220)
      } catch (_) { /* ข้ามถ้าสร้างไม่ได้ */ }
    }

    return (
      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
        <p className="font-medium text-center text-green-700 mb-3">✅ {success}</p>

        {/* QR PromptPay */}
        {qrImgUrl && lastOrder && (
          <div className="flex flex-col items-center mb-3">
            <p className="text-xs text-gray-500 mb-1.5">สแกน PromptPay เพื่อชำระเงิน</p>
            <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100">
              <img
                src={qrImgUrl}
                alt="QR PromptPay"
                className="w-40 h-40 block"
              />
            </div>
            <p className="mt-2 text-xl font-bold text-gray-800">
              ฿{Number(lastOrder.order.total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* ปุ่มปริ้น */}
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
    )
  }

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
                className="card p-3 text-left hover:shadow-md hover:border-coffee-300 transition-all active:scale-95"
              >
                {/* รูปภาพสินค้า */}
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2 flex items-center justify-center">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    : <span className="text-3xl">{EMOJI(p.categories?.name)}</span>
                  }
                </div>
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
          {CustomerSection()}

          <div className="px-4 py-3 border-t border-gray-100 space-y-2">
            {redeemDiscount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600">ส่วนลดแต้ม 🎁</span>
                <span className="font-semibold text-green-600">-฿{redeemDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">รวมทั้งหมด</span>
              <div className="text-right">
                {redeemDiscount > 0 && (
                  <p className="text-xs text-gray-400 line-through">฿{total.toLocaleString()}</p>
                )}
                <span className="text-xl font-bold text-coffee-700">฿{orderTotal.toLocaleString()}</span>
              </div>
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
          className="md:hidden fixed bottom-20 right-4 z-40 bg-coffee-600 text-white
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
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
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
            {CustomerSection()}

            <div className="px-4 pt-3 pb-4 border-t border-gray-100 space-y-2 bg-white shrink-0"
                 style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
              {redeemDiscount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600">ส่วนลดแต้ม 🎁</span>
                  <span className="font-semibold text-green-600">-฿{redeemDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">รวมทั้งหมด</span>
                <div className="text-right">
                  {redeemDiscount > 0 && (
                    <p className="text-xs text-gray-400 line-through">฿{total.toLocaleString()}</p>
                  )}
                  <span className="text-2xl font-bold text-coffee-700">฿{orderTotal.toLocaleString()}</span>
                </div>
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

              {/* 🍬 ระดับความหวาน */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">🍬 ระดับความหวาน</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGAR_OPTIONS.map((opt, i) => (
                    <button
                      key={opt}
                      onClick={() => setCustomize(c => ({ ...c, sugarLevel: opt }))}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                        ${SUGAR_OPTIONS.length % 2 !== 0 && i === SUGAR_OPTIONS.length - 1 ? 'col-span-2' : ''}
                        ${customize.sugarLevel === opt
                          ? 'border-coffee-600 bg-coffee-50 text-coffee-700'
                          : 'border-gray-200 text-gray-600 hover:border-coffee-300 bg-white'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 🧾 สูตร (แสดงส่วนผสมสำหรับบาริสต้า ไม่แสดงต้นทุน) */}
              {costInfo.breakdown.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-purple-800 mb-2">🧾 สูตร</p>
                  <div className="space-y-1">
                    {costInfo.breakdown.map((ing, i) => (
                      <div key={i} className="flex justify-between text-xs text-purple-700">
                        <span>{ing.inventory?.name}</span>
                        <span className="font-semibold">{ing.quantity} {ing.inventory?.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* หมายเหตุเพิ่มเติม */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">หมายเหตุเพิ่มเติม</p>
                <input
                  type="text"
                  value={customize.customNote}
                  onChange={e => setCustomize(c => ({ ...c, customNote: e.target.value }))}
                  placeholder="เช่น ไม่ใส่น้ำแข็ง, เพิ่มช็อต, ใส่วิปครีม..."
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
