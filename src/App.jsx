import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, ROLE_DEFAULT } from './contexts/AuthContext'
import Layout    from './components/Layout'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS       from './pages/POS'
import Orders    from './pages/Orders'
import MenuAdmin from './pages/MenuAdmin'
import Inventory from './pages/Inventory'
import Staff     from './pages/Staff'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, role } = useAuth()

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-coffee-50 text-coffee-600 text-lg">
        กำลังโหลด...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_DEFAULT[role] || '/pos'} replace />
  }

  return children
}

function RoleRedirect() {
  const { role } = useAuth()
  return <Navigate to={ROLE_DEFAULT[role] || '/pos'} replace />
}

function LoginGuard() {
  const { user, role } = useAuth()
  if (user === undefined) return (
    <div className="min-h-screen flex items-center justify-center bg-coffee-50 text-coffee-600 text-lg">
      กำลังโหลด...
    </div>
  )
  if (user) return <Navigate to={ROLE_DEFAULT[role] || '/pos'} replace />
  return <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginGuard />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<RoleRedirect />} />

          <Route path="dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="pos" element={
            <ProtectedRoute allowedRoles={['admin', 'cashier']}>
              <POS />
            </ProtectedRoute>
          } />

          <Route path="orders" element={
            <ProtectedRoute allowedRoles={['admin', 'cashier', 'barista']}>
              <Orders />
            </ProtectedRoute>
          } />

          <Route path="menu" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MenuAdmin />
            </ProtectedRoute>
          } />

          <Route path="inventory" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Inventory />
            </ProtectedRoute>
          } />

          <Route path="staff" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Staff />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
