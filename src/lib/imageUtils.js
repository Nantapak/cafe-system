/**
 * imageUtils.js
 * Resize รูปภาพด้วย Canvas API (ไม่ต้องติดตั้ง package)
 * แล้ว upload ขึ้น Supabase Storage
 */

const MAX_SIZE = 600   // px (ด้านที่ยาวที่สุด)
const QUALITY  = 0.85  // JPEG quality

/**
 * Resize รูปภาพโดยรักษาสัดส่วน ไม่ว่าจะอัปโหลดขนาดเท่าไหร่
 * @param {File} file — ไฟล์รูปภาพ
 * @param {number} maxSize — ขนาดสูงสุด (px)
 * @param {number} quality — คุณภาพ JPEG (0–1)
 * @returns {Promise<Blob>} — รูปที่ resize แล้วเป็น JPEG blob
 */
export function resizeImage(file, maxSize = MAX_SIZE, quality = QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // คำนวณขนาดใหม่โดยรักษา aspect ratio
      if (width > maxSize || height > maxSize) {
        if (width >= height) {
          height = Math.round((height * maxSize) / width)
          width  = maxSize
        } else {
          width  = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      // smooth rendering สำหรับรูปที่ย่อลงมาก
      ctx.imageSmoothingEnabled  = true
      ctx.imageSmoothingQuality  = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('ไม่สามารถ resize รูปได้'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('โหลดรูปภาพไม่สำเร็จ'))
    }

    img.src = url
  })
}

/**
 * Upload รูปไปยัง Supabase Storage bucket: menu-images
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Blob} blob — JPEG blob จาก resizeImage()
 * @param {string} originalName — ชื่อไฟล์ต้นฉบับ (สำหรับ path)
 * @returns {Promise<string>} — public URL ของรูป
 */
export async function uploadMenuImage(supabase, blob, originalName = 'image') {
  const safe = originalName.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)
  const path = `menu/${Date.now()}-${safe}.jpg`

  const { error } = await supabase.storage
    .from('menu-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

  if (error) throw error

  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}

/**
 * ลบรูปเก่าออกจาก Supabase Storage (ถ้ามี)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} url — public URL ที่ต้องการลบ
 */
export async function deleteMenuImage(supabase, url) {
  try {
    if (!url || !url.includes('/menu-images/')) return
    // ดึง path หลัง /menu-images/
    const path = url.split('/menu-images/')[1]
    if (path) await supabase.storage.from('menu-images').remove([path])
  } catch (_) { /* ไม่ต้อง alert ถ้าลบไม่ได้ */ }
}

/**
 * Helper: อ่านไฟล์เป็น data URL สำหรับ preview ก่อน upload
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
