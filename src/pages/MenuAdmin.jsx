import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight, FlaskConical, Layers } from 'lucide-react'

const EMPTY_FORM = { name: '', description: '', price: '', category_id: '', is_available: true, image_url: '' }

export default function MenuAdmin() {
  const [categories, setCategories] = useState([])
  const [products,   setProducts]   = useState([])
  const [inventory,  setInventory]  = useState([])
  const [allSizes,   setAllSizes]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editId,     setEditId]     = useState(null)
  const [showModal,  setShowModal]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [filterCat,  setFilterCat]  = useState(null)

  // --- Sizes ---
  const [sizeModal,  setSizeModal]  = useState(null)
  const [newSize,    setNewSize]    = useState({ name: '', price: '' })
  const [savingSize, setSavingSize] = useState(false)

  // --- Ingredients ---
  const [ingModal,    setIngModal]    = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [ingSizeFilter, setIngSizeFilter] = useState('all')
  const [newIng,      setNewIng]      = useState({ inventory_id: '', quantity: '', size_id: '' })
  const [savingIng,   setSavingIng]   = useState(false)
  const [ingCounts,   setIngCounts]   = useState({})
  const [sizeCounts,  setSizeCounts]  = useState({})
  const [costMap,     setCostMap]     = useState({})   // productId → ต้นทุนฐาน (general ings)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: prods }, { data: inv }, { data: sz }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('*, categories(name)').order('sort_order'),
      supabase.from('inventory').select('id, name, unit, cost_per_unit').order('name'),
      supabase.from('product_sizes').select('*').order('sort_order'),
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    setInventory(inv || [])
    setAllSizes(sz || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!products.length) return
    Promise.all([
      supabase.from('product_sizes').select('product_id'),
      supabase.from('product_ingredients')
        .select('product_id, quantity, size_id, inventory(cost_per_unit)'),
    ]).then(([{ data: szRows }, { data: ingRows }]) => {
      const sc = {}, ic = {}, cm = {}
      szRows?.forEach(r => { sc[r.product_id] = (sc[r.product_id] || 0) + 1 })
      ingRows?.forEach(r => {
        ic[r.product_id] = (ic[r.product_id] || 0) + 1
        // ต้นทุนฐาน = ส่วนผสมที่ใช้กับทุก size (size_id = null)
        if (!r.size_id) {
          cm[r.product_id] = (cm[r.product_id] || 0)
            + Number(r.quantity) * Number(r.inventory?.cost_per_unit || 0)
        }
      })
      setSizeCounts(sc)
      setIngCounts(ic)
      setCostMap(cm)
    })
  }, [products])

  // ---- Product CRUD ----
  const openNew  = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true) }
  const openEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', price: String(p.price),
      category_id: p.category_id || '', is_available: p.is_available, image_url: p.image_url || '' })
    setEditId(p.id); setShowModal(true)
  }
  const saveProduct = async () => {
    if (!form.name || !form.price) return alert('กรุณากรอกชื่อและราคา')
    setSaving(true)
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      price: parseFloat(form.price), category_id: form.category_id || null,
      is_available: form.is_available, image_url: form.image_url.trim() || null,
    }
    if (editId) await supabase.from('products').update(payload).eq('id', editId)
    else        await supabase.from('products').insert(payload)
    setSaving(false); setShowModal(false); fetchAll()
  }
  const deleteProduct = async (id) => {
    if (!confirm('ลบสินค้านี้?')) return
    await supabase.from('products').delete().eq('id', id); fetchAll()
  }
  const toggleAvailable = async (p) => {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id); fetchAll()
  }

  // ---- Sizes ----
  const openSizeModal = (product) => {
    setSizeModal(product)
    setNewSize({ name: '', price: '' })
  }
  const productSizes = (productId) => allSizes.filter(s => s.product_id === productId)

  const addSize = async () => {
    if (!newSize.name || !newSize.price) return alert('กรอกชื่อ Size และราคา')
    setSavingSize(true)
    const nextOrder = productSizes(sizeModal.id).length
    await supabase.from('product_sizes').insert({
      product_id: sizeModal.id, name: newSize.name.trim(),
      price: parseFloat(newSize.price), sort_order: nextOrder,
    })
    setSavingSize(false); setNewSize({ name: '', price: '' }); fetchAll()
  }
  const deleteSize = async (id) => {
    if (!confirm('ลบ Size นี้? ส่วนผสมที่ผูกกับ Size นี้จะถูกลบด้วย')) return
    await supabase.from('product_sizes').delete().eq('id', id); fetchAll()
  }

  // ---- Ingredients ----
  const fetchIngredients = async (productId) => {
    const { data } = await supabase
      .from('product_ingredients')
      .select('id, quantity, inventory_id, size_id, inventory(name, unit, cost_per_unit), product_sizes(name)')
      .eq('product_id', productId)
      .order('size_id', { nullsFirst: true })
    setIngredients(data || [])
  }
  const openIngModal = async (product) => {
    setIngModal(product)
    setIngSizeFilter('all')
    setNewIng({ inventory_id: '', quantity: '', size_id: '' })
    await fetchIngredients(product.id)
  }

  const addIngredient = async () => {
    if (!newIng.inventory_id || !newIng.quantity) return alert('กรุณาเลือกวัตถุดิบและปริมาณ')
    setSavingIng(true)
    const { error } = await supabase.from('product_ingredients').insert({
      product_id:   ingModal.id,
      inventory_id: newIng.inventory_id,
      quantity:     parseFloat(newIng.quantity),
      size_id:      newIng.size_id || null,
    })
    if (error) {
      alert(error.message.includes('duplicate') ? 'วัตถุดิบ+Size นี้มีอยู่แล้ว' : error.message)
    }
    setSavingIng(false)
    setNewIng({ inventory_id: '', quantity: '', size_id: '' })
    await fetchIngredients(ingModal.id)
  }
  const removeIngredient = async (id) => {
    await supabase.from('product_ingredients').delete().eq('id', id)
    setIngredients(prev => prev.filter(i => i.id !== id))
  }
  const updateIngQty = async (id, qty) => {
    if (!qty || isNaN(qty) || Number(qty) <= 0) return
    await supabase.from('product_ingredients').update({ quantity: parseFloat(qty) }).eq('id', id)
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, quantity: parseFloat(qty) } : i))
  }

  const filteredIngredients = ingredients.filter(i => {
    if (ingSizeFilter === 'all')     return true
    if (ingSizeFilter === 'general') return !i.size_id
    return i.size_id === ingSizeFilter
  })

  const filtered = filterCat ? products.filter(p => p.category_id === filterCat) : products
  const pSizes = ingModal ? productSizes(ingModal.id) : []

  const costForFilter = filteredIngredients.reduce((sum, ing) => {
    const invItem = inventory.find(i => i.id === ing.inventory_id)
    return sum + Number(ing.quantity) * Number(invItem?.cost_per_unit || 0)
  }, 0)

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">จัดการเมนู</h1>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> เพิ่มสินค้า
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button onClick={() => setFilterCat(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${!filterCat ? 'bg-coffee-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >ทั้งหมด ({products.length})</button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filterCat === c.id ? 'bg-coffee-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >{c.name} ({products.filter(p => p.category_id === c.id).length})</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="card overflow-hidden">

          {/* ───── Mobile: Card list (< sm) ───── */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filtered.length === 0 && (
              <p className="text-center py-10 text-gray-400 text-sm">ไม่มีสินค้า</p>
            )}
            {filtered.map(p => (
              <div key={p.id} className={`px-4 py-3 ${!p.is_available ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.categories?.name || '—'}
                      <span className="mx-1">·</span>
                      <span className="font-semibold text-coffee-700">฿{Number(p.price).toLocaleString()}</span>
                    </p>
                    {/* Size & Ingredient badges */}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <button onClick={() => openSizeModal(p)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600">
                        <Layers size={10} />
                        {sizeCounts[p.id] ? `${sizeCounts[p.id]} size` : 'ตั้ง size'}
                      </button>
                      <button onClick={() => openIngModal(p)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-600">
                        <FlaskConical size={10} />
                        {ingCounts[p.id] ? `${ingCounts[p.id]} ส่วนผสม` : 'ตั้งส่วนผสม'}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => toggleAvailable(p)} title={p.is_available ? 'ปิดการขาย' : 'เปิดการขาย'}
                      className="p-1.5 rounded-lg">
                      {p.is_available
                        ? <ToggleRight size={22} className="text-green-500" />
                        : <ToggleLeft  size={22} className="text-gray-300" />}
                    </button>
                    <button onClick={() => openEdit(p)} title="แก้ไข"
                      className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)} title="ลบ"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ───── Desktop: Table (sm+) ───── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">ชื่อสินค้า</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold hidden md:table-cell">หมวดหมู่</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">ราคาเริ่มต้น</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-semibold">Size</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-semibold hidden lg:table-cell">ส่วนผสม</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-semibold">สถานะ</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.categories?.name || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-coffee-700">฿{Number(p.price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openSizeModal(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                          bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                        <Layers size={12} />
                        {sizeCounts[p.id] ? `${sizeCounts[p.id]} size` : 'ตั้งค่า'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <button onClick={() => openIngModal(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                          bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
                        <FlaskConical size={12} />
                        {ingCounts[p.id] ? `${ingCounts[p.id]} รายการ` : 'ตั้งค่า'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleAvailable(p)} className="inline-flex items-center gap-1 text-xs">
                        {p.is_available
                          ? <><ToggleRight size={20} className="text-green-500" /><span className="text-green-600">พร้อมขาย</span></>
                          : <><ToggleLeft  size={20} className="text-gray-300" /><span className="text-gray-400">ปิด</span></>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-10 text-gray-400 text-sm">ไม่มีสินค้า</p>
            )}
          </div>
        </div>
      )}

      {/* ===== Modal: Sizes ===== */}
      {sizeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-blue-500" />
                  <h2 className="font-bold text-gray-800">จัดการ Size — {sizeModal.name}</h2>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">กำหนดขนาดและราคาต่อ Size</p>
              </div>
              <button onClick={() => { setSizeModal(null); fetchAll() }}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="px-5 py-4 space-y-2 max-h-64 overflow-y-auto">
              {productSizes(sizeModal.id).length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">ยังไม่มี Size — เพิ่มด้านล่าง</p>
              ) : productSizes(sizeModal.id).map(s => (
                <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <span className="font-bold text-gray-700 w-12">{s.name}</span>
                  <span className="flex-1 text-coffee-600 font-semibold">฿{Number(s.price).toLocaleString()}</span>
                  <button onClick={() => deleteSize(s.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">เพิ่ม Size ใหม่</p>
              <div className="flex gap-2">
                <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="ชื่อ เช่น S / M / L"
                  value={newSize.name}
                  onChange={e => setNewSize(n => ({ ...n, name: e.target.value }))}
                />
                <input className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  type="number" placeholder="ราคา"
                  value={newSize.price}
                  onChange={e => setNewSize(n => ({ ...n, price: e.target.value }))}
                />
                <button onClick={addSize} disabled={savingSize}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-1">
                  <Plus size={14} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                💡 เช่น S/M/L, เล็ก/กลาง/ใหญ่, 8oz/12oz/16oz
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Ingredients ===== */}
      {ingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical size={16} className="text-purple-500" />
                  <h2 className="font-bold text-gray-800">ส่วนผสม — {ingModal.name}</h2>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">ปริมาณต่อ 1 แก้ว / ชิ้น</p>
              </div>
              <button onClick={() => { setIngModal(null); fetchAll() }}><X size={20} className="text-gray-400" /></button>
            </div>

            {pSizes.length > 0 && (
              <div className="flex gap-1 px-5 pt-3 overflow-x-auto">
                <button onClick={() => setIngSizeFilter('all')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                    ${ingSizeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >ทั้งหมด</button>
                <button onClick={() => setIngSizeFilter('general')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                    ${ingSizeFilter === 'general' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >🔗 ทุก Size</button>
                {pSizes.map(s => (
                  <button key={s.id} onClick={() => setIngSizeFilter(s.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                      ${ingSizeFilter === s.id ? 'bg-coffee-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >Size {s.name}</button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {filteredIngredients.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">ยังไม่มีส่วนผสม</p>
              ) : filteredIngredients.map(ing => (
                <div key={ing.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700">{ing.inventory?.name}</span>
                    {ing.size_id ? (
                      <span className="ml-2 text-xs bg-coffee-100 text-coffee-600 px-1.5 py-0.5 rounded font-medium">
                        Size {ing.product_sizes?.name}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">ทุก Size</span>
                    )}
                  </div>
                  <input type="number" min="0.001" step="0.5"
                    defaultValue={ing.quantity}
                    onBlur={e => updateIngQty(ing.id, e.target.value)}
                    className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <span className="text-xs text-gray-400 w-10 shrink-0">{ing.inventory?.unit}</span>
                  <button onClick={() => removeIngredient(ing.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}

              {filteredIngredients.length > 0 && costForFilter > 0 && (() => {
                // หาราคาขายสำหรับ filter ที่เลือก
                const selectedSize = ingSizeFilter !== 'all' && ingSizeFilter !== 'general'
                  ? pSizes.find(s => s.id === ingSizeFilter) : null
                const sellingPrice = selectedSize
                  ? Number(selectedSize.price)
                  : Number(ingModal?.price || 0)
                const profit    = sellingPrice > 0 ? sellingPrice - costForFilter : null
                const profitPct = sellingPrice > 0 ? Math.round(((sellingPrice - costForFilter) / sellingPrice) * 100) : null
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-800">
                        💰 ต้นทุน{selectedSize ? ` Size ${selectedSize.name}` : ''}
                      </span>
                      <span className="font-bold text-amber-700">฿{costForFilter.toFixed(2)} / แก้ว</span>
                    </div>
                    {profit !== null && sellingPrice > 0 && (
                      <div className="flex items-center justify-between text-xs border-t border-amber-200 pt-1.5">
                        <span className="text-gray-500">
                          ราคาขาย ฿{sellingPrice.toFixed(0)}
                          {selectedSize ? ` (${selectedSize.name})` : ''}
                        </span>
                        <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          กำไร ฿{profit.toFixed(2)}
                          <span className="font-normal ml-1">({profitPct}%)</span>
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">เพิ่มส่วนผสม</p>
              <div className="flex gap-2">
                <select className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  value={newIng.inventory_id}
                  onChange={e => setNewIng(n => ({ ...n, inventory_id: e.target.value }))}>
                  <option value="">— วัตถุดิบ —</option>
                  {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>

                {pSizes.length > 0 && (
                  <select className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={newIng.size_id}
                    onChange={e => setNewIng(n => ({ ...n, size_id: e.target.value }))}>
                    <option value="">ทุก Size</option>
                    {pSizes.map(s => <option key={s.id} value={s.id}>Size {s.name}</option>)}
                  </select>
                )}

                <input type="number" min="0.001" step="0.5" placeholder="ปริมาณ"
                  value={newIng.quantity}
                  onChange={e => setNewIng(n => ({ ...n, quantity: e.target.value }))}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button onClick={addIngredient} disabled={savingIng}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50">
                  <Plus size={14} /> เพิ่ม
                </button>
              </div>
              {newIng.inventory_id && (
                <p className="text-xs text-gray-400">
                  หน่วย: {inventory.find(i => i.id === newIng.inventory_id)?.unit}
                  {newIng.size_id
                    ? ` · จะใช้เฉพาะ Size ${pSizes.find(s => s.id === newIng.size_id)?.name}`
                    : ' · จะใช้กับทุก Size'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: เพิ่ม/แก้ไขสินค้า ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-800">{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อสินค้า *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="เช่น ลาเต้ร้อน" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">คำอธิบาย</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ราคา (ไม่มี Size) *</label>
                  <input className="input" type="number" min="0" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">หมวดหมู่</label>
                  <select className="input" value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))}>
                    <option value="">— เลือก —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL รูปภาพ</label>
                <input className="input" value={form.image_url} onChange={e => setForm(f => ({...f, image_url: e.target.value}))} placeholder="https://..." />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(f => ({...f, is_available: e.target.checked}))} className="rounded" />
                <span className="text-sm text-gray-700">พร้อมขาย</span>
              </label>
            </div>
            <div className="flex gap-3 px-5 pb-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={saveProduct} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
