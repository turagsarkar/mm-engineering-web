'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'
import { UserPlus, Shield, User, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'
import type { Profile } from '@/lib/types/database'

interface Props {
  users: Profile[]
  currentUserId: string
}

export function UserManagerClient({ users: initial, currentUserId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<'admin' | 'member'>('member')
  const [addPassword, setAddPassword] = useState('')
  const [adding, setAdding] = useState(false)

  // Edit user state
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!addEmail.trim() || !addPassword.trim()) return
    setAdding(true)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addEmail.trim(), password: addPassword, full_name: addName.trim(), role: addRole }),
    })
    const json = await res.json()

    if (!res.ok) {
      toast(json.error || 'Failed to create user', 'error')
    } else {
      toast('User created', 'success')
      setShowAdd(false)
      setAddEmail(''); setAddName(''); setAddPassword(''); setAddRole('member')
      router.refresh()
    }
    setAdding(false)
  }

  function openEdit(u: Profile) {
    setEditUser(u)
    setEditName(u.full_name || '')
    setEditEmail(u.email)
    setEditPassword('')
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)

    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: editUser.id,
        email: editEmail.trim() !== editUser.email ? editEmail.trim() : undefined,
        full_name: editName.trim(),
        password: editPassword || undefined,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      toast(json.error || 'Failed to update user', 'error')
    } else {
      setUsers(prev => prev.map(u => u.id === editUser.id
        ? { ...u, full_name: editName.trim() || null, email: editEmail.trim() }
        : u))
      toast(editPassword ? 'User updated — new password set' : 'User updated', 'success')
      setEditUser(null)
    }
    setSaving(false)
  }

  async function toggleRole(userId: string, current: 'admin' | 'member') {
    if (userId === currentUserId) { toast("You can't change your own role", 'error'); return }
    const next = current === 'admin' ? 'member' : 'admin'
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ role: next }).eq('id', userId)
    if (error) { toast(error.message, 'error'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: next } : u))
    toast(`Role updated to ${next}`, 'success')
  }

  async function toggleActive(userId: string, current: boolean) {
    if (userId === currentUserId) { toast("You can't deactivate yourself", 'error'); return }
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', userId)
    if (error) { toast(error.message, 'error'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !current } : u))
    toast(!current ? 'User activated' : 'User deactivated', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} team members</p>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add user
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Last login</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{u.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => toggleRole(u.id, u.role as 'admin' | 'member')}
                      disabled={u.id === currentUserId}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-colors disabled:cursor-default ${
                        u.role === 'admin'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {u.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {u.role}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500 hidden md:table-cell">
                    {u.last_login ? formatDateTime(u.last_login) : 'Never'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-gray-300 hover:text-blue-600 transition-colors"
                        title="Edit user (name, email, password)"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          className="text-gray-300 hover:text-gray-500 transition-colors"
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {u.is_active ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add user modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add team member" size="sm">
        <form onSubmit={handleAddUser} className="space-y-4">
          <Input id="ae" label="Email address *" type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} required />
          <Input id="an" label="Full name" value={addName} onChange={e => setAddName(e.target.value)} />
          <Input id="ap" label="Password * (min 8 characters)" type="password" value={addPassword} onChange={e => setAddPassword(e.target.value)} required minLength={8} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select
              value={addRole}
              onChange={e => setAddRole(e.target.value as 'admin' | 'member')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={adding}>Create user</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit user modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit — ${editUser?.full_name || editUser?.email || ''}`} size="sm">
        <form onSubmit={handleEditUser} className="space-y-4">
          <Input id="en" label="Full name" value={editName} onChange={e => setEditName(e.target.value)} />
          <Input id="ee" label="Email address" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
          <Input
            id="ep"
            label="New password (leave blank to keep current)"
            type="password"
            value={editPassword}
            onChange={e => setEditPassword(e.target.value)}
            minLength={8}
            placeholder="Min 8 characters"
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>Save changes</Button>
            <Button type="button" variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
