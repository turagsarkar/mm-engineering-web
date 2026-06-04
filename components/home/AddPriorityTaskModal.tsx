'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function AddPriorityTaskModal({ open, onClose, onCreated }: Props) {
  const { user } = useUser()
  const { toast } = useToast()
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [brandId, setBrandId] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('normal')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    createClient().from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('priority_tasks').insert({
      brand_id: brandId || null,
      message: message.trim(),
      set_by: user?.id,
      priority: priority as 'low' | 'normal' | 'high' | 'urgent',
      is_active: true,
    })
    if (error) { toast(error.message, 'error') }
    else {
      toast('Priority task added', 'success')
      setMessage(''); setBrandId(''); setPriority('normal')
      onCreated(); onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add priority task" size="sm">
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
          <Button type="submit" loading={loading}>Add task</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
