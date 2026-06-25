/**
 * cashierStore.js
 * เก็บชื่อแคชเชียร์ใน localStorage — ไม่ต้องล็อกอิน
 */

const KEY = 'pos_cashier_name'

export const getCashierName = () => localStorage.getItem(KEY) || ''
export const setCashierName = (name) => {
  if (name?.trim()) localStorage.setItem(KEY, name.trim())
  else localStorage.removeItem(KEY)
}
export const clearCashierName = () => localStorage.removeItem(KEY)
