/**
 * promptpay.js
 * สร้าง PromptPay QR Payload ตามมาตรฐาน EMVCo / BOT
 *
 * ใช้งาน:
 *   const payload = generatePromptPayPayload('0812345678', 65.00)
 *   const imgUrl  = generateQRImageURL(payload)
 */

/* ── CRC-16/CCITT (polynomial 0x1021, initial 0xFFFF) ── */
function crc16(str) {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/* ── TLV helper: tag(2) + length(2) + value ── */
function tlv(tag, value) {
  return tag + String(value.length).padStart(2, '0') + value
}

/**
 * สร้าง PromptPay QR payload string
 * @param {string} target  — เบอร์โทร (0812345678) หรือเลขบัตร (13 หลัก)
 * @param {number} amount  — ยอดเงิน THB (0 = ไม่ระบุ)
 * @returns {string} payload พร้อม CRC
 */
export function generatePromptPayPayload(target, amount = 0) {
  // ── Normalize target ──
  target = String(target).replace(/\D/g, '')

  let accountType, accountValue
  if (target.length >= 13) {
    // เลขบัตรประชาชน หรือ Tax ID
    accountType  = '02'
    accountValue = target
  } else {
    // เบอร์มือถือ → แปลงเป็น 0066XXXXXXXXX
    accountType  = '01'
    if (target.startsWith('0')) {
      accountValue = '0066' + target.slice(1)
    } else if (target.startsWith('66')) {
      accountValue = '00' + target
    } else {
      accountValue = target
    }
  }

  // ── Merchant Account Info (tag 29) ──
  const merchantInfo = tlv('00', 'A000000677010111') + tlv(accountType, accountValue)

  // ── Build payload (without CRC value) ──
  let payload = ''
  payload += tlv('00', '01')           // Payload Format Indicator
  payload += tlv('01', '12')           // Point of Initiation (12 = dynamic QR)
  payload += tlv('29', merchantInfo)   // PromptPay Merchant Account Info
  payload += tlv('53', '764')          // Transaction Currency (764 = THB)

  if (amount > 0) {
    payload += tlv('54', amount.toFixed(2))  // Transaction Amount
  }

  payload += tlv('58', 'TH')           // Country Code
  payload += '6304'                    // CRC tag + length (จะคำนวณด้านล่าง)

  return payload + crc16(payload)
}

/**
 * สร้าง URL รูป QR Code โดยใช้ api.qrserver.com (ไม่ต้องติดตั้ง package)
 * @param {string} payload — EMVCo payload string
 * @param {number} size    — ขนาดพิกเซล (default 200)
 */
export function generateQRImageURL(payload, size = 200) {
  const encoded = encodeURIComponent(payload)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&ecc=M&margin=4`
}

/**
 * ดึง PromptPay ID จาก env
 */
export const PROMPTPAY_ID = import.meta.env.VITE_PROMPTPAY_ID || ''
