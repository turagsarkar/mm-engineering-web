import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BrandsClient } from './BrandsClient'

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function BrandsPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('brands')
    .select('*')
    .order('name')

  if (filter === 'ai_do_not_quote') query = query.eq('ai_do_not_quote', true)
  if (filter === 'confirmed') query = query.eq('confirmed_suppliers', true)
  if (filter === 'review_due') {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff}`)
  }

  const { data: brands } = await query

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Brands" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{brands?.length ?? 0} brands</p>
            <Link
              href="/brands/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add brand
            </Link>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { label: 'All', value: '' },
              { label: 'Confirmed', value: 'confirmed' },
              { label: 'AI Do Not Quote', value: 'ai_do_not_quote' },
              { label: 'Review Due', value: 'review_due' },
            ].map(f => (
              <Link
                key={f.value}
                href={f.value ? `/brands?filter=${f.value}` : '/brands'}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  (filter ?? '') === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <BrandsClient brands={brands ?? []} />
          </div>
        </div>
      </div>
    </div>
  )
}
