'use client'
import Link from 'next/link'
import { ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { Brand } from '@/lib/types/database'

export function BrandsClient({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 font-medium">No brands found</p>
      </div>
    )
  }

  const reviewCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000

  return (
    <div className="divide-y divide-gray-100">
      {brands.map(brand => {
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
  )
}
