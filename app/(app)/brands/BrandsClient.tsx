'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, CheckCircle, XCircle, AlertTriangle, Search, X, Bot } from 'lucide-react'
import type { Brand } from '@/lib/types/database'

type FilterMode = 'all' | 'ai_dnq' | 'review_due' | 'confirmed'

function isReviewDue(b: Brand): boolean {
  if (b.review_disabled) return false
  // Prefer the explicit next_review_at; fall back to last + interval
  if (b.next_review_at) return new Date(b.next_review_at).getTime() <= Date.now()
  if (!b.last_reviewed_at) return true
  const next = new Date(b.last_reviewed_at)
  next.setMonth(next.getMonth() + (b.review_interval_months || 6))
  return next.getTime() <= Date.now()
}

export function BrandsClient({ brands, initialFilter = 'all' }: { brands: Brand[]; initialFilter?: FilterMode }) {
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>(initialFilter)

  const filtered = brands.filter(b => {
    const matchesSearch = !query.trim() ||
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      (b.aliases || []).some(a => a.toLowerCase().includes(query.toLowerCase()))

    const matchesFilter =
      filterMode === 'all' ? true :
      filterMode === 'ai_dnq' ? b.ai_do_not_quote :
      filterMode === 'review_due' ? isReviewDue(b) :
      filterMode === 'confirmed' ? b.confirmed_suppliers :
      true

    return matchesSearch && matchesFilter
  })

  const aiDnqCount = brands.filter(b => b.ai_do_not_quote).length
  const reviewDueCount = brands.filter(isReviewDue).length

  const filterButtons: { id: FilterMode; label: string; count?: number; color?: string }[] = [
    { id: 'all', label: 'All', count: brands.length },
    { id: 'ai_dnq', label: 'AI: Do Not Quote', count: aiDnqCount, color: 'red' },
    { id: 'review_due', label: 'Review Due', count: reviewDueCount, color: 'orange' },
    { id: 'confirmed', label: 'Confirmed', color: 'green' },
  ]

  return (
    <div>
      {/* Search + filter bar */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${brands.length} brands…`}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {filterButtons.map(f => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id === filterMode ? 'all' : f.id)}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterMode === f.id
                  ? f.color === 'red'
                    ? 'bg-red-600 text-white border-red-600'
                    : f.color === 'orange'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : f.color === 'green'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.id === 'ai_dnq' && <Bot className="h-3 w-3" />}
              {f.id === 'review_due' && <AlertTriangle className="h-3 w-3" />}
              {f.id === 'confirmed' && <CheckCircle className="h-3 w-3" />}
              {f.label}
              {f.count !== undefined && (
                <span className={`ml-0.5 font-semibold ${filterMode === f.id ? 'opacity-90' : 'text-gray-500'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {(query || filterMode !== 'all') && (
          <p className="text-xs text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {query && ` for "${query}"`}
          </p>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No brands match this filter</p>
          <button
            onClick={() => { setQuery(''); setFilterMode('all') }}
            className="text-blue-600 text-sm mt-1 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map(brand => {
            const reviewDue = isReviewDue(brand)
            return (
              <Link
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {brand.name}
                    </span>
                    {brand.ai_do_not_quote && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-0.5">
                        <Bot className="h-3 w-3" />
                        AI: DNQ
                      </span>
                    )}
                    {reviewDue && !brand.review_disabled && (
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Review due
                      </span>
                    )}
                  </div>
                  {brand.aliases && brand.aliases.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">Also: {brand.aliases.join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {brand.confirmed_suppliers ? (
                    <span className="flex items-center gap-1 text-xs text-green-700">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Confirmed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <XCircle className="h-3.5 w-3.5" />
                      Unconfirmed
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
