'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import type { Supplier } from '@/lib/types/database'

interface SupplierFormProps {
  supplier?: Supplier
  brandId?: string
  brandSlug?: string
  onSuccess?: () => void
}

export function SupplierForm({ supplier, brandId, brandSlug, onSuccess }: SupplierFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUser()
  const isEdit = !!supplier
  const bid = supplier?.brand_id ?? brandId ?? ''

  const [name, setName] = useState(supplier?.name ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [contactName, setContactName] = useState(supplier?.contact_name ?? '')
  const [margin, setMargin] = useState(supplier?.margin ?? '')
  const [whereToLook, setWhereToLook] = useState(supplier?.where_to_look ?? '')
  const [poNumber, setPoNumber] = useState(supplier?.po_number ?? '')
  const [priorityRank, setPriorityRank] = useState(String(supplier?.priority_rank ?? 999))
  const [status, setStatus] = useState(supplier?.supplier_status ?? 'active')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !bid) return
    setLoading(true)

    const supabase = createClient()
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      contact_name: contactName.trim() || null,
      margin: margin.trim() || null,
      where_to_look: whereToLook.trim() || null,
      po_number: poNumber.trim() || null,
      priority_rank: parseInt(priorityRank) || 999,
      supplier_status: status,
    }

    let error
    let entityId = supplier?.id

    if (isEdit && supplier) {
      const res = await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      error = res.error
    } else {
      const res = await supabase.from('suppliers').insert({
        ...payload,
        brand_id: bid,
        added_by: user?.id,
      }).select('id').single()
      error = res.error
      entityId = res.data?.id
    }

    if (error) {
      toast(error.message, 'error')
      setLoading(false)
      return
    }

    await supabase.from('activity_log').insert({
      user_id: user?.id,
      action_type: isEdit ? 'supplier_edited' : 'supplier_added',
      entity_type: 'supplier',
      entity_id: entityId,
      entity_name: name.trim(),
    })

    toast(isEdit ? 'Supplier updated' : 'Supplier added', 'success')
    if (onSuccess) { onSuccess(); return }
    if (brandSlug) { router.push(`/brands/${brandSlug}`); router.refresh(); return }
    router.back()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="name" label="Supplier name *" value={name} onChange={e => setName(e.target.value)} required />
      <Input id="email" type="email" label="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <Input id="contact" label="Contact name" value={contactName} onChange={e => setContactName(e.target.value)} />
      <Input id="margin" label="Margin" placeholder="e.g. 0.85" value={margin} onChange={e => setMargin(e.target.value)} />
      <Input id="where" label="Where to look" value={whereToLook} onChange={e => setWhereToLook(e.target.value)} />
      <Input id="po" label="Previous PO number" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
      <Input id="rank" label="Priority rank (lower = higher priority)" type="number" min={0} value={priorityRank} onChange={e => setPriorityRank(e.target.value)} />
      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium text-gray-700">Status</label>
        <select
          id="status"
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Add supplier'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
