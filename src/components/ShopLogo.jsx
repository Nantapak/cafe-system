/**
 * ShopLogo — SVG logo สไตล์ minimal ตามโลโก้ 5th cup
 * props:
 *   color    — สีของ SVG (default 'currentColor')
 *   iconSize — ขนาด icon px (default 36)
 *   showText — แสดงชื่อร้านหรือไม่ (default true)
 *   textColor— สีข้อความ Tailwind class
 *   subColor — สีซับไตเติล Tailwind class
 */
export default function ShopLogo({
  color     = 'currentColor',
  iconSize  = 36,
  showText  = true,
  textColor = '',
  subColor  = 'opacity-50',
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* ─── SVG Logo ─── */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── Steam ทำรูป "5" ── */}
        {/* เส้นบนแนวนอน */}
        <path d="M16 16 L26 16"
          stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        {/* เส้นซ้ายลงมา */}
        <path d="M16 16 L16 22"
          stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        {/* เส้นกลางแนวนอน */}
        <path d="M16 22 L24 22"
          stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        {/* โค้งขวาลงและวนกลับ (ท่อนล่างของ 5) */}
        <path d="M24 22 Q30 22 30 27 Q30 33 22 33 Q16 33 15 29"
          stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>

        {/* ── Cup body ── */}
        <path
          d="M6 37 L8.5 50 Q9 54 24 54 Q39 54 39.5 50 L42 37 Z"
          stroke={color} strokeWidth="1.8" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          transform="translate(0,-4)"
        />
        {/* rim บนถ้วย */}
        <line x1="5" y1="33" x2="43" y2="33"
          stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        {/* Handle */}
        <path
          d="M39 36 Q46 36 46 41 Q46 46 39 46"
          stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      </svg>

      {/* ─── Text ─── */}
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
