import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout    from './components/Layout'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS       from './pages/POS'
import Orders    from './pages/Orders'
import MenuAdmin from './pages/MenuAdmin'
import Inventory from './pages/Inventory'
import Staff       from './pages/Staff'
import SalesReport from './pages/SalesReport'
import Customers   from './pages/Customers'

/** ป้องกันเฉพาะ admin routes */
function AdminRoute({ children }) {
  const { user, role } = useAuth()

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-coffee-50 text-coffee-600 text-lg">
        กำลังโหลด...
      </div>
    )
  }

  if (!user || role !== 'admin') {
    return <Navigate to="/pos" replace />
  }

  return children
}

/** หน้า Login: ถ้า admin ล็อกอินแล้ว → dashboard */
function LoginGuard() {
  const { user, role } = useAuth()
  if (user === undefined) return (
    <div className="min-h-screen flex items-center justify-center bg-coffee-50 text-coffee-600 text-lg">
      กำลังโหลด...
    </div>
  )
  if (user && role === 'admin') return <Navigate to="/dashboard" replace />
  if (user) return <Navigate to="/pos" replace />
  return <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginGuard />} />

        {/* Layout ไม่บังคับ auth — POS/Orders เปิดเสรี */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/pos" replace />} />

          {/* เปิดเสรี — ไม่ต้อง login */}
          <Route path="pos"       element={<POS />} />
          <Route path="orders"    element={<Orders />} />
          <Route path="customers" element={<Customers />} />

          {/* Admin only */}
          <Route path="dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="menu"      element={<AdminRoute><MenuAdmin /></AdminRoute>} />
          <Route path="inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
          <Route path="staff"     element={<AdminRoute><Staff /></AdminRoute>} />
          <Route path="reports"   element={<AdminRoute><SalesReport /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </AuthProvider>
  )
}
