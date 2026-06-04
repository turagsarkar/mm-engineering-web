'use client'
import Link from 'next/link'
import { Tag, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import type { Brand } from '@/lib/types/database'

interface BrandListProps {
  brands: Brand[]
}

export function BrandList({ brands }: BrandListProps) {
  if (brands.length === 0) {
    return (
      <div className="text-center py-16">
        <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No brands yet</p>
        <p className="text-gray-400 text-sm mt-1">Add your first brand to get started</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {brands.map(brand => (
        <Link
          key={brand.id}
          href={`/brands/${brand.slug}`}
          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {brand.name}
              </span>
              {brand.ai_do_not_quote && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                  AI: DO NOT QUOTE
                </span>
              )}
            </div>
            {brand.aliases && brand.aliases.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Also known as: {brand.aliases.join(', ')}
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
      ))}
    </div>
  )
}
