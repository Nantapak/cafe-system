/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50:  '#F8F6F3',   // off-white background
          100: '#EDE8DF',   // light surface
          200: '#D4C9BB',   // border
          300: '#B0A090',   // muted text
          400: '#8A7465',   // secondary
          500: '#5E4A3A',   // medium
          600: '#3A2A1C',   // primary — dark brown (ปุ่ม, active)
          700: '#2B1F14',   // hover
          800: '#1E1510',   // sidebar background
          900: '#120C07',   // deepest
        }
      },
      fontFamily: {
        sans: ['Sarabun', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
