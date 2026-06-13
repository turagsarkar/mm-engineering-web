'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import type { PriorityTask } from '@/lib/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  task?: PriorityTask | null   // when set, the modal edits an existing task
}

export function AddPriorityTaskModal({ open, onClose, onCreated, task }: Props) {
  const { user, isAdmin } = useUser()
  const { toast } = useToast()
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [brandId, setBrandId] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('normal')
  const [loading, setLoading] = useState(false)

  const isEdit = !!task

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from('brands').select('id,name').order('name').range(from, to)
    ).then(setBrands)
    if (task) {
      setBrandId(task.brand_id ?? '')
      setMessage(task.message)
      setPriority(task.priority)
    } else {
      setBrandId(''); setMessage(''); setPriority('normal')
    }
  }, [open, task])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || !isAdmin) return
    setLoading(true)
    const supabase = createClient()

    let error
    if (isEdit && task) {
      const res = await supabase.from('priority_tasks').update({
        brand_id: brandId || null,
        message: message.trim(),
        priority: priority as 'low' | 'normal' | 'high' | 'urgent',
      }).eq('id', task.id)
      error = res.error
    } else {
      const res = await supabase.from('priority_tasks').insert({
        brand_id: brandId || null,
        message: message.trim(),
        set_by: user?.id,
        priority: priority as 'low' | 'normal' | 'high' | 'urgent',
        is_active: true,
      })
      error = res.error
    }

    if (error) { toast(error.message, 'error') }
    else {
      toast(isEdit ? 'Task updated' : 'Priority task added', 'success')
      setMessage(''); setBrandId(''); setPriority('normal')
      onCreated(); onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit priority task' : 'Add priority task'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Brand (optional)</label>
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No specific brand</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Message *</label>
          <textarea
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="What needs to be done?"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading}>{isEdit ? 'Save changes' : 'Add task'}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
