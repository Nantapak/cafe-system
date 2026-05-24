/**
 * printUtils.js
 * ปริ้นใบเสร็จพร้อมเลขคิว (รวมอยู่ในแผ่นเดียว)
 * รองรับเครื่องปริ้น Thermal 80mm
 */

import { generatePromptPayPayload, generateQRImageURL, PROMPTPAY_ID } from './promptpay.js'

const SHOP_NAME    = import.meta.env.VITE_SHOP_NAME    || 'ร้านกาแฟ'
const SHOP_TAGLINE = import.meta.env.VITE_SHOP_TAGLINE || 'Cafe Management'
const SHOP_EMOJI   = import.meta.env.VITE_SHOP_EMOJI   || '☕'

function fmtDate(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    day:    '2-digit',
    month:  '2-digit',
    year:   '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function fmtMoney(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ═══════════════════════════════════════════════════
   ใบเสร็จ + คิว รวมแผ่นเดียว
═══════════════════════════════════════════════════ */
export function printReceipt(order, items) {
  const isCancelled  = order.status === 'cancelled'

  /* ── สร้าง QR PromptPay (ถ้ามี VITE_PROMPTPAY_ID) ── */
  let qrBlock = ''
  if (PROMPTPAY_ID && !isCancelled) {
    try {
      const payload = generatePromptPayPayload(PROMPTPAY_ID, Number(order.total))
      const qrUrl   = generateQRImageURL(payload, 200)
      qrBlock = `
        <hr class="divider" />
        <div class="qr-wrap">
          <div class="qr-label">สแกน PromptPay เพื่อชำระเงิน</div>
          <img class="qr-img" src="${qrUrl}" alt="QR PromptPay" />
          <div class="qr-amt">฿${fmtMoney(order.total)}</div>
        </div>
      `
    } catch (_) { /* ถ้าสร้าง QR ไม่ได้ก็ข้ามไป */ }
  }
  const rows = items.map(item => {
    const sizePart = item.size_name ? ` (${item.size_name})` : ''
    const notePart = item.note
      ? `<div class="note">↳ ${item.note}</div>`
      : ''
    const lineStyle = isCancelled ? ' style="text-decoration:line-through;color:#999;"' : ''
    return `
      <div class="row"${lineStyle}>
        <span class="item-name">${item.name}${sizePart} ×${item.quantity}</span>
        <span class="item-price">฿${fmtMoney(item.price * item.quantity)}</span>
      </div>
      ${notePart}
    `
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>ใบเสร็จ #${order.order_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
    @page { size: 80mm auto; margin: 2mm 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Sarabun', 'Courier New', monospace;
      font-size: 13px;
      color: #000;
      width: 76mm;
      padding: 4mm 4mm;
    }
    .center  { text-align: center; }
    .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .divider-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }

    /* ── เลขคิว ── */
    .queue-wrap  { text-align: center; padding: 4px 0 2px; }
    .queue-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; color: #555; }
    .queue-num   { font-size: 48px; font-weight: 800; line-height: 1; letter-spacing: -1px; }

    /* ── หัวร้าน ── */
    .shop-name { font-size: 17px; font-weight: 700; }
    .shop-sub  { font-size: 11px; color: #666; margin-top: 1px; }
    .meta      { font-size: 11px; color: #555; margin-top: 3px; }

    /* ── รายการ ── */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 3px 0;
      gap: 6px;
    }
    .item-name  { flex: 1; line-height: 1.4; }
    .item-price { white-space: nowrap; }
    .note {
      font-size: 11px;
      color: #444;
      margin: 0 0 3px 8px;
      font-style: italic;
    }

    /* ── ยอดรวม ── */
    .total-row {
      font-size: 17px;
      font-weight: 700;
    }

    /* ── ยกเลิก ── */
    .cancelled-banner {
      text-align: center;
      background: #000;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 3px;
      padding: 4px 0;
      margin-bottom: 4px;
    }

    /* ── QR PromptPay ── */
    .qr-wrap  { text-align: center; margin: 6px 0 4px; }
    .qr-img   { width: 140px; height: 140px; }
    .qr-label { font-size: 11px; color: #555; margin-top: 2px; }
    .qr-amt   { font-size: 15px; font-weight: 700; margin-top: 2px; }

    /* ── ท้าย ── */
    .footer { font-size: 11px; color: #999; margin-top: 5px; }
  </style>
</head>
<body>

  ${order.status === 'cancelled' ? `<div class="cancelled-banner">⚠ ยกเลิกออเดอร์แล้ว</div>` : ''}

  <!-- คิว -->
  <div class="queue-wrap">
    <div class="queue-label">คิวออเดอร์</div>
    <div class="queue-num">#${order.order_number}</div>
  </div>

  <hr class="divider-solid" />

  <!-- ชื่อร้าน -->
  <div class="center">
    <div class="shop-name">${SHOP_EMOJI} ${SHOP_NAME}</div>
    <div class="shop-sub">${SHOP_TAGLINE}</div>
    <div class="meta">${fmtDate(order.created_at)}</div>
  </div>

  <hr class="divider" />

  <!-- รายการ -->
  ${rows}

  <hr class="divider" />

  <!-- ยอดรวม -->
  <div class="row total-row">
    <span>รวมทั้งหมด</span>
    <span>฿${fmtMoney(order.total)}</span>
  </div>

  <!-- QR PromptPay -->
  ${qrBlock}

  <hr class="divider" />

  <!-- ท้าย -->
  <div class="center footer">
    ขอบคุณที่ใช้บริการ 🙏
  </div>

</body>
</html>`

  openPrintWindow(html, `receipt-${order.order_number}`)
}

// alias เผื่อโค้ดอื่นยังเรียกชื่อเดิม
export const printBaristaSlip = printReceipt
export const printBoth        = printReceipt

/* ═══════════════════════════════════════════════════
   Helper: เปิดหน้าต่างปริ้น
═══════════════════════════════════════════════════ */
function openPrintWindow(html, name) {
  const win = window.open('', name, 'width=420,height=650')
  if (!win) {
    alert('กรุณาอนุญาต Pop-up จากเว็บไซต์นี้ก่อนปริ้น')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  win.onload = () => {
    setTimeout(() => {
      win.print()
      win.close()
    }, 350)
  }
}
