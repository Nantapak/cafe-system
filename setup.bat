@echo off
echo.
echo  ============================================
echo   ☕ ติดตั้ง ระบบร้านกาแฟ
echo  ============================================
echo.

:: ตรวจสอบ Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [!] ไม่พบ Node.js — กรุณาติดตั้งก่อน
    echo      ดาวน์โหลดได้ที่: https://nodejs.org
    pause
    exit /b 1
)

echo  [1/3] ติดตั้ง packages...
call npm install
if errorlevel 1 (
    echo  [!] npm install ล้มเหลว
    pause
    exit /b 1
)

echo.
echo  [2/3] ตรวจสอบว่ามีไฟล์ .env หรือยัง...
if not exist .env (
    copy .env.example .env
    echo  [!] สร้างไฟล์ .env แล้ว — กรุณาเปิดและใส่ค่า Supabase ก่อน
    echo.
    echo      VITE_SUPABASE_URL=https://xxxx.supabase.co
    echo      VITE_SUPABASE_ANON_KEY=eyJhbGci...
    echo.
    notepad .env
    pause
)

echo.
echo  [3/3] เริ่มเซิร์ฟเวอร์ท้องถิ่น...
echo  เปิดเบราว์เซอร์ที่ http://localhost:5173
echo.
call npm run dev
