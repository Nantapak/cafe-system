#!/bin/bash
echo ""
echo "============================================"
echo " ☕ ติดตั้ง ระบบร้านกาแฟ"
echo "============================================"
echo ""

# ตรวจสอบ Node.js
if ! command -v node &> /dev/null; then
    echo "[!] ไม่พบ Node.js — กรุณาติดตั้งก่อน: https://nodejs.org"
    exit 1
fi

echo "[1/3] ติดตั้ง packages..."
npm install || { echo "[!] npm install ล้มเหลว"; exit 1; }

echo ""
echo "[2/3] ตรวจสอบไฟล์ .env..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[!] สร้างไฟล์ .env แล้ว — กรุณาแก้ไขค่า Supabase:"
    echo ""
    echo "    VITE_SUPABASE_URL=https://xxxx.supabase.co"
    echo "    VITE_SUPABASE_ANON_KEY=eyJhbGci..."
    echo ""
    echo "    เปิดไฟล์ .env เพื่อแก้ไข แล้วรัน: npm run dev"
    exit 0
fi

echo ""
echo "[3/3] เริ่มเซิร์ฟเวอร์..."
echo "เปิดเบราว์เซอร์ที่ http://localhost:5173"
echo ""
npm run dev
