import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { UserPlus, Pencil, Trash2, Eye, EyeOff, X, Check, RefreshCw } from 'lucide-react'

const ROLES = [
  { value: 'admin',   label: 'Admin — ผู้จัดการ (เข้าได้ทุกหน้า)' },
  { value: 'cashier', label: 'Cashier — แคชเชียร์ (POS + ออเดอร์)' },
  { value: 'barista', label: 'Barista — บาริสต้า (ออเดอร์เท่านั้น)' },
]

const ROLE_BADGE = {
  admin:   'bg-purple-100 text-purple-700 border-purple-200',
  cashier: 'bg-blue-100   text-blue-700   border-blue-200',
  barista: 'bg-green-100  text-green-700  border-green-200',
}

const ROLE_TH = {
  admin:   'Admin',
  cashier: 'Cashier',
  barista: 'Barista',
}

const EMPTY_FORM = { username: '', displayName: '', role: 'cashier', password: '' }

export default function Staff() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // null | 'add' | 'edit'
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [editId,  setEditId]  = useState(null)
  const [showPwd, setShowPwd] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  /* ─── โหลดรายชื่อพนักงาน ─── */
  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (!error) {
      const sorted = (data?.users || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )
      setUsers(sorted)
    }
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  /* ─── เปิด Modal เพิ่ม ─── */
  const openAdd = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setShowPwd(false)
    setModal('add')
  }

  /* ─── เปิด Modal แก้ไข ─── */
  const openEdit = (u) => {
    setEditId(u.id)
    setForm({
      username:    u.user_metadata?.username || u.email?.replace('@cafe.local', '') || '',
      displayName: u.user_metadata?.name     || '',
      role:        u.user_metadata?.role     || 'cashier',
      password:    '',
    })
    setError(null)
    setShowPwd(false)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditId(null) }

  /* ─── บันทึก ─── */
  const handleSave = async () => {
    if (!form.username.trim())     { setError('กรุณากรอกชื่อผู้ใช้');   return }
    if (!form.displayName.trim())  { setError('กรุณากรอกชื่อแสดง');    return }
    if (modal === 'add' && !form.password) { setError('กรุณาตั้งรหัสผ่าน'); return }
    if (form.password && form.password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }

    setSaving(true)
    setError(null)

    const uname = form.username.trim().toLowerCase().replace(/\s/g, '')
    const email = `${uname}@cafe.local`
    const meta  = {
      role:     form.role,
      name:     form.displayName.trim(),
      username: uname,
    }

    try {
      if (modal === 'add') {
        // ตรวจซ้ำ username
        const dup = users.find(u =>
          (u.user_metadata?.username || u.email?.replace('@cafe.local','')) === uname
        )
        if (dup) { setError('ชื่อผู้ใช้นี้มีอยู่แล้ว'); setSaving(false); return }

        const { error: err } = await supabaseAdmin.auth.admin.createUser({
          email,
          password:       form.password,
          email_confirm:  true,
          user_metadata:  meta,
        })
        if (err) throw err

      } else {
        const updates = { user_metadata: meta }
        if (form.password) updates.password = form.password

        const { error: err } = await supabaseAdmin.auth.admin.updateUserById(editId, updates)
        if (err) throw err
      }

      await fetchUsers()
      closeModal()
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  /* ─── ลบพนักงาน ─── */
  const handleDelete = async (u) => {
    const name = u.user_metadata?.name || u.user_metadata?.username || 'พนักงานคนนี้'
    if (!confirm(`ลบ "${name}" ออกจากระบบ?\n\nพนักงานจะเข้าสู่ระบบไม่ได้อีก`)) return
    await supabaseAdmin.auth.admin.deleteUser(u.id)
    fetchUsers()
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })

  /* ─── UI ─── */
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">จัดการพนักงาน</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="btn-secondary flex items-center gap-1.5 text-sm py-1.5"
          >
            <RefreshCw size={14} /> รีเฟรช
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <UserPlus size={16} /> เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ROLES.map(r => (
          <span
            key={r.value}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE[r.value]}`}
          >
            {r.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">ชื่อผู้ใช้</th>
                <th className="px-4 py-3 font-semibold text-gray-600">ชื่อแสดง</th>
                <th className="px-4 py-3 font-semibold text-gray-600">สิทธิ์</th>
                <th className="px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">สร้างเมื่อ</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => {
                const uname = u.user_metadata?.username || u.email?.replace('@cafe.local', '')
                const name  = u.user_metadata?.name    || '-'
                const role  = u.user_metadata?.role    || '-'
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-700">{uname}</td>
                    <td className="px-4 py-3 text-gray-700">{name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border
                        ${ROLE_BADGE[role] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {ROLE_TH[role] || role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                      {fmtDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          title="แก้ไข"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-coffee-600 hover:bg-coffee-50 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="ลบ"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-10 text-gray-400">ยังไม่มีพนักงาน</div>
          )}
        </div>
      )}

      {/* ─── Modal เพิ่ม / แก้ไข ─── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {modal === 'add' ? '➕ เพิ่มพนักงานใหม่' : '✏️ แก้ไขข้อมูลพนักงาน'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ใช้ <span className="text-gray-400 font-normal">(username)</span>
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g,'') }))}
                  className="input w-full disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="เช่น barista01"
                  disabled={modal === 'edit'}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {modal === 'edit' && (
                  <p className="text-xs text-gray-400 mt-1">⚠ ไม่สามารถเปลี่ยนชื่อผู้ใช้ได้</p>
                )}
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อแสดง</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="input w-full"
                  placeholder="เช่น น้องมิ้ว"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์การเข้าถึง</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="input w-full"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {modal === 'add' ? 'รหัสผ่าน' : 'รหัสผ่านใหม่'}
                  {modal === 'edit' && (
                    <span className="text-gray-400 font-normal ml-1">(เว้นว่างถ้าไม่เปลี่ยน)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input w-full pr-10"
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="btn-secondary flex-1 text-sm">
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'กำลังบันทึก...' : <><Check size={15} /> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
