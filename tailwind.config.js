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
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f3d9a8',
          300: '#e8bc6c',
          400: '#dc9a3a',
          500: '#c97f20',
          600: '#a96318',
          700: '#8a4b18',
          800: '#703c1a',
          900: '#5c3219',
        }
      }
    },
  },
  plugins: [],
}
