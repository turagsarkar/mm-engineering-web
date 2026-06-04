'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import { slugify } from '@/lib/utils/format'
import type { Brand } from '@/lib/types/database'

interface BrandFormProps {
  brand?: Brand
  onSuccess?: () => void
}

export function BrandForm({ brand, onSuccess }: BrandFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUser()
  const isEdit = !!brand

  const [name, setName] = useState(brand?.name ?? '')
  const [aliases, setAliases] = useState((brand?.aliases ?? []).join(', '))
  const [notificationText, setNotificationText] = useState(brand?.notification_text ?? '')
  const [reviewInterval, setReviewInterval] = useState(String(brand?.review_interval_months ?? 6))
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const payload = {
      name: name.trim(),
      slug: slugify(name.trim()),
      aliases: aliases.split(',').map(a => a.trim()).filter(Boolean),
      notification_text: notificationText || null,
      review_interval_months: parseInt(reviewInterval) || 6,
    }

    let error
    let entityId = brand?.id

    if (isEdit && brand) {
      const res = await supabase.from('brands').update(payload).eq('id', brand.id)
      error = res.error
    } else {
      const res = await supabase.from('brands').insert({ ...payload, created_by: user?.id }).select('id').single()
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
      action_type: isEdit ? 'brand_edited' : 'brand_added',
      entity_type: 'brand',
      entity_id: entityId,
      entity_name: name.trim(),
    })

    toast(isEdit ? 'Brand updated' : 'Brand added', 'success')
    if (onSuccess) { onSuccess(); return }
    router.push('/brands')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="name"
        label="Brand name *"
        placeholder="e.g. ABB"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <Input
        id="aliases"
        label="Aliases (comma-separated)"
        placeholder="e.g. ABB Ltd, Asea Brown Boveri"
        value={aliases}
        onChange={e => setAliases(e.target.value)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="notif" className="text-sm font-medium text-gray-700">
          Notification message
        </label>
        <textarea
          id="notif"
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Warning shown when this brand is selected in n8n…"
          value={notificationText}
          onChange={e => setNotificationText(e.target.value)}
        />
      </div>
      <Input
        id="review"
        label="Review interval (months)"
        type="number"
        min={1}
        max={24}
        value={reviewInterval}
        onChange={e => setReviewInterval(e.target.value)}
      />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Add brand'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
