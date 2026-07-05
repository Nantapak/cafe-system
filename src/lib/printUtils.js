/**
 * printUtils.js
 * ปริ้นใบเสร็จพร้อมเลขคิว (รวมอยู่ในแผ่นเดียว)
 * รองรับเครื่องปริ้น Thermal 80mm
 */

import { generatePromptPayPayload, generateQRImageURL, PROMPTPAY_ID } from './promptpay.js'
import { SHOP_LOGO_B64 } from './shopLogo.js'

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
/**
 * แปลง UUID เป็นรหัสสมาชิกสั้น เช่น MBR-A1B2C3D4
 * ไม่เปิดเผยชื่อจริง แต่ unique ต่อสมาชิก
 */
function memberCode(id) {
  return 'MBR-' + id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

/**
 * @param {object} order
 * @param {array}  items
 * @param {object|null} memberInfo — { id, points, pointsEarned, pointsUsed }
 */
export function printReceipt(order, items, memberInfo = null) {
  const isCancelled  = order.status === 'cancelled'

  /* ── สร้าง QR PromptPay (ถ้ามี VITE_PROMPTPAY_ID) ── */
  let qrBlock = ''
  if (PROMPTPAY_ID && !isCancelled && order.payment_method !== 'cash') {
    try {
      const payload = generatePromptPayPayload(PROMPTPAY_ID, Number(order.total))
      const qrUrl   = generateQRImageURL(payload, 160)
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

    /* ── กระดาษ 80mm ── */
    @page {
      size: 80mm auto;
      margin: 2mm 3mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html {
      width: 80mm;
    }

    body {
      font-family: 'Sarabun', 'TH Sarabun New', 'Courier New', monospace;
      font-size: 13px;
      color: #000;
      width: 74mm;
      max-width: 74mm;
      margin: 0 auto;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      html {
        width: 80mm;
      }
      body {
        width: 74mm;
        max-width: 74mm;
      }
    }

    .center  { text-align: center; }
    .divider { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    .divider-solid { border: none; border-top: 2px solid #000; margin: 4px 0; }

    /* ── เลขคิว ── */
    .queue-wrap  { text-align: center; padding: 3px 0 2px; }
    .queue-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; color: #555; }
    .queue-num   { font-size: 40px; font-weight: 800; line-height: 1; letter-spacing: -1px; }

    /* ── หัวร้าน ── */
    .shop-logo { width: 64px; height: auto; display: block; margin: 0 auto 3px; }
    .shop-name { font-size: 15px; font-weight: 700; }
    .shop-sub  { font-size: 10px; color: #666; margin-top: 1px; }
    .meta      { font-size: 10px; color: #555; margin-top: 2px; }

    /* ── รายการ ── */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 2px 0;
      gap: 4px;
    }
    .item-name  { flex: 1; line-height: 1.4; word-break: break-word; }
    .item-price { white-space: nowrap; }
    .note {
      font-size: 10px;
      color: #444;
      margin: 0 0 2px 6px;
      font-style: italic;
    }

    /* ── ยอดรวม ── */
    .total-row {
      font-size: 15px;
      font-weight: 700;
    }

    /* ── ยกเลิก ── */
    .cancelled-banner {
      text-align: center;
      background: #000;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 3px;
      padding: 3px 0;
      margin-bottom: 3px;
    }

    /* ── QR PromptPay ── */
    .qr-wrap  { text-align: center; margin: 4px 0 3px; }
    .qr-img   { width: 110px; height: 110px; }
    .qr-label { font-size: 10px; color: #555; margin-top: 2px; }
    .qr-amt   { font-size: 13px; font-weight: 700; margin-top: 2px; }

    /* ── ท้าย ── */
    .footer { font-size: 10px; color: #999; margin-top: 4px; }

    /* ── สมาชิก ── */
    .member-wrap  { margin: 3px 0; padding: 4px 5px; border: 1px dashed #ccc; border-radius: 4px; }
    .member-id    { font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    .member-pts   { font-size: 10px; color: #555; margin-top: 2px; }
    .member-bar-wrap { display: flex; gap: 2px; margin-top: 3px; }
    .member-bar-cell { flex: 1; height: 5px; border-radius: 2px; }
    .member-bar-fill { background: #92400e; }
    .member-bar-empty{ background: #e5e7eb; }
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

  <!-- โลโก้ -->
  <div class="center">
    <img class="shop-logo" src="${SHOP_LOGO_B64}" alt="${SHOP_NAME}" />
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

  <!-- สมาชิก -->
  ${memberInfo ? (() => {
    const code   = memberCode(memberInfo.id)
    const pts    = memberInfo.points
    const earned = memberInfo.pointsEarned || 0
    const used   = memberInfo.pointsUsed   || 0
    const prog   = pts % 10
    const bars   = Array.from({ length: 10 }, (_, i) =>
      `<div class="member-bar-cell ${i < prog ? 'member-bar-fill' : 'member-bar-empty'}"></div>`
    ).join('')
    return `
      <div class="member-wrap">
        <div class="row">
          <span class="member-id">${code}</span>
          <span class="member-pts" style="font-weight:700">⭐ ${pts} แต้ม</span>
        </div>
        <div class="member-bar-wrap">${bars}</div>
        <div class="member-pts">
          ออเดอร์นี้ +${earned} แต้ม${used > 0 ? ` / แลก -${used} แต้ม` : ''}
          · อีก ${10 - prog} แต้มรับฟรี 1 แก้ว
        </div>
      </div>
    `
  })() : ''}

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
  const win = window.open('', name, 'width=302,height=600')
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
