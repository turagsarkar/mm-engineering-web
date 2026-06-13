'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import type { Supplier } from '@/lib/types/database'

type TrafficLightValue = 'green' | 'amber' | 'red'

const TL_RANK: Record<TrafficLightValue, number> = { green: 1, amber: 2, red: 3 }

const TL_OPTIONS: { value: TrafficLightValue; label: string; dot: string }[] = [
  { value: 'green', label: 'Green – Primary Supplier', dot: 'bg-green-500' },
  { value: 'amber', label: 'Amber – Alternative/Stock Supplier', dot: 'bg-amber-400' },
  { value: 'red', label: 'Red – Do Not Use', dot: 'bg-red-500' },
]

interface SupplierFormProps {
  supplier?: Supplier
  brandId?: string
  brandSlug?: string
  onSuccess?: () => void
}

export function SupplierForm({ supplier, brandId, brandSlug, onSuccess }: SupplierFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isAdmin } = useUser()
  const isEdit = !!supplier
  const bid = supplier?.brand_id ?? brandId ?? ''

  const [name, setName] = useState(supplier?.name ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [contactName, setContactName] = useState(supplier?.contact_name ?? '')
  const [margin, setMargin] = useState(supplier?.margin ?? '')
  const [whereToLook, setWhereToLook] = useState(supplier?.where_to_look ?? '')
  const [poNumber, setPoNumber] = useState(supplier?.po_number ?? '')
  const [trafficLight, setTrafficLight] = useState<TrafficLightValue>(
    (supplier?.traffic_light as TrafficLightValue) ?? 'green'
  )
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Load existing general note on edit
  useEffect(() => {
    if (!isEdit || !supplier) return
    createClient()
      .from('supplier_notes')
      .select('note_text')
      .eq('supplier_id', supplier.id)
      .eq('note_type', 'general')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setNotes(data.note_text) })
  }, [isEdit, supplier])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !bid) return
    setLoading(true)

    const supabase = createClient()

    // New entries under a brand with an open priority task need admin
    // approval first (members only — admin entries go straight in).
    let needsApproval = false
    if (!isEdit && !isAdmin) {
      const { data: openTasks } = await supabase
        .from('priority_tasks')
        .select('id')
        .eq('brand_id', bid)
        .eq('is_active', true)
        .limit(1)
      needsApproval = !!openTasks && openTasks.length > 0
    }

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      contact_name: contactName.trim() || null,
      margin: margin.trim() || null,
      where_to_look: whereToLook.trim() || null,
      po_number: poNumber.trim() || null,
      traffic_light: trafficLight,
      priority_rank: TL_RANK[trafficLight],
      supplier_status: needsApproval ? 'pending' : 'active',
    }

    let error
    let entityId = supplier?.id

    if (isEdit && supplier) {
      const { supplier_status: _ignored, ...editPayload } = payload
      const res = await supabase.from('suppliers').update(editPayload).eq('id', supplier.id)
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

    // Save notes if provided
    if (notes.trim() && entityId) {
      if (isEdit) {
        // Delete existing general note and insert new one
        await supabase.from('supplier_notes')
          .delete()
          .eq('supplier_id', entityId)
          .eq('note_type', 'general')
        if (notes.trim()) {
          await supabase.from('supplier_notes').insert({
            supplier_id: entityId,
            note_type: 'general',
            note_text: notes.trim(),
            created_by: user?.id,
          })
        }
      } else {
        await supabase.from('supplier_notes').insert({
          supplier_id: entityId,
          note_type: 'general',
          note_text: notes.trim(),
          created_by: user?.id,
        })
      }
    }

    // Points are only logged for entries that go straight in; pending
    // entries are logged by the approval API when an admin approves.
    if (!needsApproval) {
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action_type: isEdit ? 'supplier_edited' : 'supplier_added',
        entity_type: 'supplier',
        entity_id: entityId,
        entity_name: name.trim(),
      })
    }

    toast(
      needsApproval
        ? 'Submitted — this brand has an open priority task, so an admin must approve it first'
        : isEdit ? 'Supplier updated' : 'Supplier added',
      'success'
    )
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

      {/* Traffic light dropdown */}
      <div className="flex flex-col gap-1">
        <label htmlFor="trafficLight" className="text-sm font-medium text-gray-700">Priority</label>
        <div className="relative">
          <select
            id="trafficLight"
            value={trafficLight}
            onChange={e => setTrafficLight(e.target.value as TrafficLightValue)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            {TL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${TL_OPTIONS.find(o => o.value === trafficLight)?.dot}`} />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-gray-700">Notes</label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="General notes about this supplier…"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
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
