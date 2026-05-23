# ☕ คู่มือติดตั้งและ Deploy ระบบร้านกาแฟ
**React + Vite + Supabase → Vercel (ฟรี)**

---

## 📋 สิ่งที่ต้องมีก่อน

| สิ่งที่ต้องการ | ลิงก์ | หมายเหตุ |
|---|---|---|
| Node.js 18+ | https://nodejs.org | ดาวน์โหลด LTS |
| บัญชี GitHub | https://github.com | ฟรี |
| บัญชี Supabase | https://supabase.com | ฟรี |
| บัญชี Vercel | https://vercel.com | ฟรี ใช้ GitHub login ได้ |

---

## 🗄️ ขั้นตอนที่ 1 — ตั้งค่า Supabase (Database)

### 1.1 สร้าง Project
1. เข้า https://supabase.com → **Start your project**
2. กด **New project**
3. ตั้งค่า:
   - **Name:** `cafe-system`
   - **Database Password:** ตั้งรหัสแล้วจดไว้
   - **Region:** `Southeast Asia (Singapore)` ← สำคัญ เพื่อความเร็ว
4. กด **Create new project** → รอ 1–2 นาที

### 1.2 รัน SQL Schema
1. ใน Supabase → เมนูซ้าย **SQL Editor** → **New query**
2. เปิดไฟล์ `supabase/schema.sql` แล้ว Copy ทั้งหมด
3. Paste ลงใน SQL Editor
4. กด **Run** (หรือ Ctrl+Enter)
5. เห็น `Success. No rows returned` = ผ่าน ✅

### 1.3 เก็บ API Keys
1. เมนูซ้าย **Settings** → **API**
2. Copy 2 ค่านี้ไว้:
   - **Project URL** → เช่น `https://abcxyz123.supabase.co`
   - **anon / public key** → ยาวมาก ขึ้นต้น `eyJhbGci...`

---

## 💻 ขั้นตอนที่ 2 — รันบนเครื่องของคุณ (Local)

### Windows
```bat
cd cafe-system
setup.bat
```

### Mac / Linux
```bash
cd cafe-system
chmod +x setup.sh
./setup.sh
```

### หรือรันด้วยตนเอง
```bash
cd cafe-system
npm install

# สร้างไฟล์ .env
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux

# แก้ไข .env ใส่ค่าจาก Supabase
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGci...

npm run dev
```

เปิด **http://localhost:5173** → ควรเห็นระบบทำงาน ✅

---

## 🐙 ขั้นตอนที่ 3 — Push โค้ดขึ้น GitHub

```bash
cd cafe-system

# เริ่ม git (ครั้งแรก)
git init
git add .
git commit -m "feat: cafe management system"

# เชื่อม GitHub (เปลี่ยน YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/cafe-system.git
git branch -M main
git push -u origin main
```

> ⚠️ ไฟล์ `.env` จะ**ไม่ถูก** push ขึ้น GitHub (มี `.gitignore` ป้องกันแล้ว)

---

## 🚀 ขั้นตอนที่ 4 — Deploy บน Vercel

### 4.1 Import Project
1. เข้า https://vercel.com → **Log in with GitHub**
2. กด **Add New Project**
3. เลือก repository `cafe-system` → กด **Import**

### 4.2 ตั้งค่า Environment Variables
ก่อนกด Deploy ให้ขยาย **Environment Variables** แล้วเพิ่ม:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` |

### 4.3 Deploy
1. กด **Deploy** → รอประมาณ 1–2 นาที
2. ได้ URL เช่น `https://cafe-system-abc123.vercel.app` 🎉

---

## ✅ ตรวจสอบหลัง Deploy

เปิด URL จาก Vercel แล้วทดสอบ:

- [ ] หน้า **Dashboard** โหลดได้ (อาจว่างเปล่าเพราะยังไม่มีข้อมูล)
- [ ] หน้า **POS** แสดงเมนูและหมวดหมู่
- [ ] ลองสั่งออเดอร์ → ไปที่หน้า **Orders** เพื่อดู
- [ ] หน้า **จัดการเมนู** เพิ่ม/แก้ไขสินค้าได้
- [ ] หน้า **สต็อก** แสดงวัตถุดิบและแจ้งเตือนของใกล้หมด

---

## 🔧 แก้ปัญหาเบื้องต้น

### เห็นหน้าขาว / Error ใน Console
→ ตรวจสอบว่าใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ถูกต้อง
→ ใน Vercel: Settings → Environment Variables → แก้ไข → Redeploy

### หน้า POS ไม่แสดงเมนู
→ ตรวจสอบว่ารัน `schema.sql` ใน Supabase แล้ว (มี seed data อยู่ในนั้น)

### หน้า Refresh แล้ว 404
→ ตรวจสอบว่ามีไฟล์ `vercel.json` ใน root ของโปรเจกต์ (มีอยู่แล้ว)

### Deploy ใหม่อัตโนมัติ
→ ทุกครั้งที่ `git push` Vercel จะ deploy ให้อัตโนมัติ

---

## 📁 โครงสร้างโปรเจกต์

```
cafe-system/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx    ← แดชบอร์ด + กราฟยอดขาย
│   │   ├── POS.jsx          ← หน้าแคชเชียร์
│   │   ├── Orders.jsx       ← ติดตามออเดอร์
│   │   ├── MenuAdmin.jsx    ← จัดการเมนู
│   │   └── Inventory.jsx    ← สต็อกวัตถุดิบ
│   ├── components/
│   │   ├── Layout.jsx       ← Layout หลัก
│   │   └── Sidebar.jsx      ← เมนูด้านซ้าย
│   └── lib/
│       └── supabase.js      ← Supabase client
├── supabase/
│   └── schema.sql           ← รัน SQL นี้ใน Supabase
├── .env.example             ← template สำหรับ .env
├── vercel.json              ← config SPA routing
└── setup.bat / setup.sh     ← script ติดตั้งอัตโนมัติ
```

---

## 💡 ขั้นตอนต่อไป (ถ้าต้องการเพิ่ม)

- **การเข้าสู่ระบบ (Auth)** → เพิ่ม Supabase Auth + หน้า Login
- **การพิมพ์ใบเสร็จ** → ใช้ `window.print()` หรือ react-to-print
- **Domain ของตัวเอง** → ซื้อที่ Namecheap แล้วเชื่อมใน Vercel Settings
- **LINE Notify** → แจ้งเตือนออเดอร์ใหม่ผ่าน LINE
