import { SHOP_LOGO_B64 } from '../lib/shopLogo.js'

/**
 * ShopLogo — โลโก้ร้านจากไฟล์จริง (PNG โปร่งใส สีดำ)
 * props:
 *   iconSize  — ความสูง icon px (default 36)
 *   showText  — แสดงชื่อร้านหรือไม่ (default true)
 *   textColor — Tailwind class สีข้อความ
 *   subColor  — Tailwind class สีซับไตเติล
 *   invert    — true = กลับสีเป็นขาว (สำหรับพื้นหลังเข้ม)
 */
export default function ShopLogo({
  iconSize  = 36,
  showText  = true,
  textColor = 'text-coffee-800',
  subColor  = 'text-coffee-400',
  invert    = false,
}) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={SHOP_LOGO_B64}
        alt="5th cup logo"
        style={{
          height: iconSize,
          width: 'auto',
          filter: invert ? 'invert(1) brightness(2)' : 'none',
        }}
      />
      {showText && (
        <div>
          <p className={`font-semibold text-base leading-tight tracking-tight ${textColor}`}>
            <span className="font-black">5th</span> cup
          </p>
          <p className={`text-[11px] leading-none font-light tracking-wide ${subColor}`}>
            Fifth cup
          </p>
        </div>
      )}
    </div>
  )
}
