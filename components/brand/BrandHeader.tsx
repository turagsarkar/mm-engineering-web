'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Edit2, AlertTriangle, CheckCircle, Clock, Bot, CalendarCheck, Calendar, BellOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils/format'
import type { Brand, Database } from '@/lib/types/database'

type BrandUpdate = Database['public']['Tables']['brands']['Update']

interface BrandHeaderProps {
  brand: Brand
  onUpdate: (b: Partial<Brand>) => void
}

export function BrandHeader({ brand, onUpdate }: BrandHeaderProps) {
  const { isAdmin, user } = useUser()
  const { toast } = useToast()
  const [confirmedLoading, setConfirmedLoading] = useState(false)
  const [showSetDate, setShowSetDate] = useState(false)

  // Calendar-accurate: next review = last reviewed + interval months
  function addMonths(date: Date, months: number) {
    const d = new Date(date)
    d.setMonth(d.getMonth() + months)
    return d
  }
  const nextReviewDate = brand.last_reviewed_at
    ? addMonths(new Date(brand.last_reviewed_at), brand.review_interval_months)
    : null

  const [reviewDate, setReviewDate] = useState(
    nextReviewDate ? nextReviewDate.toISOString().split('T')[0] : ''
  )
  const reviewDue = !brand.review_disabled &&
    (!nextReviewDate || nextReviewDate.getTime() <= Date.now())

  async function patch(updates: BrandUpdate) {
    const supabase = createClient()
    const { error } = await supabase.from('brands').update(updates).eq('id', brand.id)
    if (error) { toast(error.message, 'error'); return false }
    onUpdate(updates as Partial<Brand>)
    return true
  }

  async function toggleDoNotQuote() {
    if (!isAdmin) return
    const next = !brand.ai_do_not_quote
    if (await patch({ ai_do_not_quote: next })) {
      const supabase = createClient()
      await supabase.from('activity_log').insert({
        user_id: user?.id, action_type: 'brand_edited', entity_type: 'brand',
        entity_id: brand.id, entity_name: brand.name,
        details: { field: 'ai_do_not_quote', value: next },
      })
      toast('AI status updated', 'success')
    }
  }

  async function toggleConfirmed() {
    if (!isAdmin) return
    setConfirmedLoading(true)
    const next = !brand.confirmed_suppliers
    if (await patch({ confirmed_suppliers: next })) {
      const supabase = createClient()
      await supabase.from('activity_log').insert({
        user_id: user?.id, action_type: 'brand_edited', entity_type: 'brand',
        entity_id: brand.id, entity_name: brand.name,
        details: { field: 'confirmed_suppliers', value: next },
      })
      toast('Updated', 'success')
    }
    setConfirmedLoading(false)
  }

  async function markReviewed() {
    const now = new Date().toISOString()
    if (await patch({ last_reviewed_at: now, reviewed_by: user?.id ?? null })) {
      toast('Marked as reviewed', 'success')
      setShowSetDate(false)
    }
  }

  // The date picked is the NEXT review date; we back-compute last_reviewed_at
  // so "next review = last reviewed + interval" lands exactly on the chosen day.
  async function saveReviewDate() {
    if (!reviewDate) return
    const lastReviewed = addMonths(new Date(reviewDate), -brand.review_interval_months)
    if (await patch({ last_reviewed_at: lastReviewed.toISOString(), reviewed_by: user?.id ?? null })) {
      toast(`Next review set to ${formatDate(new Date(reviewDate).toISOString())}`, 'success')
      setShowSetDate(false)
    }
  }

  async function toggleReviewDisabled() {
    const next = !brand.review_disabled
    if (await patch({ review_disabled: next })) {
      toast(next ? 'Reviews disabled' : 'Reviews re-enabled', 'success')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {brand.notification_text && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border-2 border-red-300 rounded-lg text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
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
            <p className="text-sm text-gray-500 mt-0.5">Also: {brand.aliases.join(', ')}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
            {!brand.review_disabled && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Review every {brand.review_interval_months}mo
              </span>
            )}
            {brand.last_reviewed_at && (
              <span>Last reviewed: {formatDate(brand.last_reviewed_at)}</span>
            )}
            {!brand.review_disabled && nextReviewDate && (
              <span className={reviewDue ? 'text-orange-600 font-medium' : ''}>
                Next review: {formatDate(nextReviewDate.toISOString())}
              </span>
            )}
            {brand.review_disabled && (
              <span className="flex items-center gap-1 text-gray-400">
                <BellOff className="h-3.5 w-3.5" /> Reviews disabled
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
              {brand.confirmed_suppliers ? 'Confirmed' : 'Unconfirmed'}
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
              {brand.ai_do_not_quote ? 'AI: DNQ' : 'AI: OK'}
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

      {/* Review section */}
      {!brand.review_disabled && reviewDue && (
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-sm font-medium text-orange-800">Review due</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={markReviewed}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Mark as reviewed today
            </button>
            <button
              onClick={() => setShowSetDate(!showSetDate)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-orange-300 text-orange-700 bg-white rounded-lg hover:bg-orange-50 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Set next review date
            </button>
            <button
              onClick={toggleReviewDisabled}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-300 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            >
              <BellOff className="h-3.5 w-3.5" />
              Disable reviews
            </button>
          </div>
          {showSetDate && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="date"
                value={reviewDate}
                onChange={e => setReviewDate(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={saveReviewDate}
                className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manage review when not due */}
      {!brand.review_disabled && !reviewDue && brand.last_reviewed_at && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSetDate(!showSetDate)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            Change next review date
          </button>
          <button
            onClick={toggleReviewDisabled}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <BellOff className="h-3.5 w-3.5" />
            Disable reviews
          </button>
          {showSetDate && (
            <div className="flex items-center gap-2 w-full">
              <input
                type="date"
                value={reviewDate}
                onChange={e => setReviewDate(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={saveReviewDate}
                className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {brand.review_disabled && (
        <button
          onClick={toggleReviewDisabled}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <BellOff className="h-3.5 w-3.5" />
          Re-enable reviews
        </button>
      )}
    </div>
  )
}
