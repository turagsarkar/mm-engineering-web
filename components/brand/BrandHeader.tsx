'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Edit2, AlertTriangle, CheckCircle, Clock, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils/format'
import type { Brand } from '@/lib/types/database'

interface BrandHeaderProps {
  brand: Brand
  onUpdate: (b: Partial<Brand>) => void
}

export function BrandHeader({ brand, onUpdate }: BrandHeaderProps) {
  const { isAdmin, user } = useUser()
  const { toast } = useToast()
  const [confirmedLoading, setConfirmedLoading] = useState(false)

  async function toggleDoNotQuote() {
    if (!isAdmin) return
    const next = !brand.ai_do_not_quote
    const supabase = createClient()
    const { error } = await supabase.from('brands').update({ ai_do_not_quote: next }).eq('id', brand.id)
    if (error) { toast(error.message, 'error') }
    else {
      onUpdate({ ai_do_not_quote: next })
      await supabase.from('activity_log').insert({
        user_id: user?.id, action_type: 'brand_edited', entity_type: 'brand',
        entity_id: brand.id, entity_name: brand.name,
        details: { field: 'ai_do_not_quote', value: next },
      })
      toast(`AI status updated`, 'success')
    }
  }

  async function toggleConfirmed() {
    if (!isAdmin) return
    setConfirmedLoading(true)
    const next = !brand.confirmed_suppliers
    const supabase = createClient()
    const { error } = await supabase
      .from('brands')
      .update({ confirmed_suppliers: next })
      .eq('id', brand.id)
    if (error) { toast(error.message, 'error') }
    else {
      onUpdate({ confirmed_suppliers: next })
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action_type: 'brand_edited',
        entity_type: 'brand',
        entity_id: brand.id,
        entity_name: brand.name,
        details: { field: 'confirmed_suppliers', value: next },
      })
      toast('Updated', 'success')
    }
    setConfirmedLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {brand.notification_text && (
        <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          {brand.notification_text}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{brand.name}</h2>
            {brand.ai_do_not_quote && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                AI: DO NOT QUOTE
              </span>
            )}
          </div>
          {brand.aliases && brand.aliases.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              Also: {brand.aliases.join(', ')}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Review every {brand.review_interval_months}mo
            </span>
            {brand.last_reviewed_at && (
              <span>Last reviewed: {formatDate(brand.last_reviewed_at)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={toggleConfirmed}
              disabled={confirmedLoading}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                brand.confirmed_suppliers
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {brand.confirmed_suppliers ? 'Confirmed Suppliers' : 'Mark Confirmed'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={toggleDoNotQuote}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                brand.ai_do_not_quote
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              {brand.ai_do_not_quote ? 'AI: Do Not Quote' : 'AI: OK to Quote'}
            </button>
          )}
          <Link
            href={`/brands/${brand.slug}/edit`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>
    </div>
  )
}
