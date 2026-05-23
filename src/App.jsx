import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard  from './pages/Dashboard'
import POS        from './pages/POS'
import Orders     from './pages/Orders'
import MenuAdmin  from './pages/MenuAdmin'
import Inventory  from './pages/Inventory'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="pos"        element={<POS />} />
        <Route path="orders"     element={<Orders />} />
        <Route path="menu"       element={<MenuAdmin />} />
        <Route path="inventory"  element={<Inventory />} />
      </Route>
    </Routes>
  )
}
