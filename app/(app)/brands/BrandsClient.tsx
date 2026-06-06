'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, CheckCircle, XCircle, AlertTriangle, Search, X } from 'lucide-react'
import type { Brand } from '@/lib/types/database'

export function BrandsClient({ brands }: { brands: Brand[] }) {
  const [query, setQuery] = useState('')

  const reviewCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000

  const filtered = query.trim()
    ? brands.filter(b =>
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        (b.aliases || []).some(a => a.toLowerCase().includes(query.toLowerCase()))
      )
    : brands

  return (
    <div>
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-gray-100">
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
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {query && (
          <p className="text-xs text-gray-400 mt-1.5 pl-1">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No brands found for &ldquo;{query}&rdquo;</p>
          <button onClick={() => setQuery('')} className="text-blue-600 text-sm mt-1 hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map(brand => {
            const reviewDue = !brand.last_reviewed_at || new Date(brand.last_reviewed_at).getTime() < reviewCutoff
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
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                        AI: DO NOT QUOTE
                      </span>
                    )}
                    {reviewDue && (
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Review due
                      </span>
                    )}
                  </div>
                  {brand.aliases && brand.aliases.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      Also: {brand.aliases.join(', ')}
                    </p>
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
