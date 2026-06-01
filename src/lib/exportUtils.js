/**
 * exportUtils.js
 * Export ข้อมูลเป็น Excel (.xlsx) โดยใช้ SheetJS (dynamic import)
 */

/* ── helper ── */
const fmtDate = (iso) =>
  new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

const fmtDateOnly = (iso) =>
  new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

async function getXLSX() {
  const mod = await import('xlsx')
  return mod.default ?? mod
}

function autoWidth(ws, data, XLSX) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const colWidths = keys.map(k => {
    const maxData = Math.max(...data.map(r => String(r[k] ?? '').length))
    return { wch: Math.max(k.length, maxData) + 2 }
  })
  ws['!cols'] = colWidths
}

/* ══════════════════════════════════════════
   1. ยอดขายรายวัน/เดือน
═══════════════════════════════════════════ */
export async function exportSalesReport({ orders, startDate, endDate }) {
  const XLSX = await getXLSX()
  const wb = XLSX.utils.book_new()
  const rangeLabel = `${fmtDateOnly(startDate)} - ${fmtDateOnly(endDate)}`

  /* ── Sheet 1: สรุปยอดขายรายวัน ── */
  const dailyMap = {}
  orders.forEach(o => {
    const d = o.created_at.slice(0, 10)
    if (!dailyMap[d]) dailyMap[d] = { วันที่: d, จำนวนออเดอร์: 0, ยอดขาย: 0, ยกเลิก: 0 }
    if (o.status === 'cancelled') dailyMap[d].ยกเลิก++
    else { dailyMap[d].จำนวนออเดอร์++; dailyMap[d].ยอดขาย += Number(o.total) }
  })
  const dailyRows = Object.values(dailyMap).sort((a, b) => a.วันที่.localeCompare(b.วันที่))
  dailyRows.push({
    วันที่: 'รวม',
    จำนวนออเดอร์: dailyRows.reduce((s, r) => s + r.จำนวนออเดอร์, 0),
    ยอดขาย:      dailyRows.reduce((s, r) => s + r.ยอดขาย, 0),
    ยกเลิก:      dailyRows.reduce((s, r) => s + r.ยกเลิก, 0),
  })
  const ws1 = XLSX.utils.json_to_sheet(dailyRows)
  autoWidth(ws1, dailyRows)
  XLSX.utils.book_append_sheet(wb, ws1, 'ยอดขายรายวัน')

  /* ── Sheet 2: รายการออเดอร์ ── */
  const orderRows = []
  orders.forEach(o => {
    ;(o.order_items || [{ name: '-', quantity: '-', price: '-' }]).forEach((item, idx) => {
      orderRows.push({
        วันที่:     idx === 0 ? fmtDate(o.created_at) : '',
        คิว:        idx === 0 ? `#${o.order_number}` : '',
        สินค้า:    item.name,
        จำนวน:     item.quantity,
        ราคา:      item.price,
        ยอดรวม:    idx === 0 ? (o.status === 'cancelled' ? 0 : Number(o.total)) : '',
        สถานะ:     idx === 0 ? o.status : '',
        แคชเชียร์: idx === 0 ? (o.cashier_name || '-') : '',
      })
    })
  })
  const ws2 = XLSX.utils.json_to_sheet(orderRows)
  autoWidth(ws2, orderRows)
  XLSX.utils.book_append_sheet(wb, ws2, 'รายการออเดอร์')

  /* ── Sheet 3: สินค้าขายดี ── */
  const productMap = {}
  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    ;(o.order_items || []).forEach(item => {
      if (!productMap[item.name]) productMap[item.name] = { สินค้า: item.name, จำนวนแก้ว: 0, ยอดขาย: 0 }
      productMap[item.name].จำนวนแก้ว += item.quantity
      productMap[item.name].ยอดขาย   += item.price * item.quantity
    })
  })
  const productRows = Object.values(productMap).sort((a, b) => b.จำนวนแก้ว - a.จำนวนแก้ว)
  const ws3 = XLSX.utils.json_to_sheet(productRows)
  autoWidth(ws3, productRows)
  XLSX.utils.book_append_sheet(wb, ws3, 'สินค้าขายดี')

  XLSX.writeFile(wb, `ยอดขาย_${rangeLabel.replace(/\//g, '-').replace(/ /g, '')}.xlsx`)
}

/* ══════════════════════════════════════════
   2. สต็อกวัตถุดิบ
═══════════════════════════════════════════ */
export async function exportInventory(items) {
  const XLSX = await getXLSX()
  const wb = XLSX.utils.book_new()

  /* ── Sheet 1: สต็อกปัจจุบัน ── */
  const stockRows = items.map(i => ({
    ชื่อวัตถุดิบ:       i.name,
    คงเหลือ:           Number(i.quantity),
    หน่วย:             i.unit,
    ขั้นต่ำ:           Number(i.min_quantity),
    ต้นทุนต่อหน่วย:    Number(i.cost_per_unit || 0),
    มูลค่าคงเหลือ:     Number((i.quantity * (i.cost_per_unit || 0)).toFixed(2)),
    สถานะ:             Number(i.quantity) <= Number(i.min_quantity) ? '⚠ สต็อกต่ำ' : 'ปกติ',
  }))
  // summary
  const totalValue = stockRows.reduce((s, r) => s + r.มูลค่าคงเหลือ, 0)
  stockRows.push({
    ชื่อวัตถุดิบ: 'รวมมูลค่าทั้งหมด',
    คงเหลือ: '', หน่วย: '', ขั้นต่ำ: '', ต้นทุนต่อหน่วย: '',
    มูลค่าคงเหลือ: Number(totalValue.toFixed(2)),
    สถานะ: '',
  })

  const ws1 = XLSX.utils.json_to_sheet(stockRows)
  autoWidth(ws1, stockRows)
  XLSX.utils.book_append_sheet(wb, ws1, 'สต็อกวัตถุดิบ')

  const lowRows = items
    .filter(i => Number(i.quantity) <= Number(i.min_quantity))
    .map(i => ({
      ชื่อวัตถุดิบ: i.name,
      คงเหลือ: Number(i.quantity), หน่วย: i.unit,
      ขั้นต่ำ: Number(i.min_quantity),
      ขาดอีก: Number(i.min_quantity) - Number(i.quantity),
    }))
  if (lowRows.length) {
    const ws2 = XLSX.utils.json_to_sheet(lowRows)
    autoWidth(ws2, lowRows)
    XLSX.utils.book_append_sheet(wb, ws2, 'สต็อกต่ำ')
  }

  const today = new Date().toLocaleDateString('th-TH').replace(/\//g, '-')
  XLSX.writeFile(wb, `สต็อกวัตถุดิบ_${today}.xlsx`)
}

/* ══════════════════════════════════════════
   3. รายการออเดอร์ทั้งหมด (จากหน้า Orders)
═══════════════════════════════════════════ */
export async function exportOrders(orders, dateLabel) {
  const XLSX = await getXLSX()
  const wb = XLSX.utils.book_new()

  const rows = []
  orders.forEach(o => {
    const items = o.order_items || []
    if (!items.length) {
      rows.push({
        วันที่:      fmtDate(o.created_at),
        คิว:         `#${o.order_number}`,
        สินค้า:     '-',
        ระดับความหวาน: '-',
        จำนวน:      '-',
        ราคา:       '-',
        ยอดรวม:     o.status === 'cancelled' ? 0 : Number(o.total),
        ส่วนลด:     Number(o.discount || 0),
        สถานะ:      o.status,
        แคชเชียร์:  o.cashier_name || '-',
      })
    } else {
      items.forEach((item, idx) => {
        rows.push({
          วันที่:      idx === 0 ? fmtDate(o.created_at) : '',
          คิว:         idx === 0 ? `#${o.order_number}` : '',
          สินค้า:     item.name,
          หมายเหตุ:   item.note || '',
          จำนวน:      item.quantity,
          ราคา:       item.price,
          ยอดรวม:     idx === 0 ? (o.status === 'cancelled' ? 0 : Number(o.total)) : '',
          ส่วนลด:     idx === 0 ? Number(o.discount || 0) : '',
          สถานะ:      idx === 0 ? o.status : '',
          แคชเชียร์:  idx === 0 ? (o.cashier_name || '-') : '',
        })
      })
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'ออเดอร์')
  XLSX.writeFile(wb, `ออเดอร์_${dateLabel}.xlsx`)
}
