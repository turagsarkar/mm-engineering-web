import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { BrandsClient } from './BrandsClient'
import type { Brand } from '@/lib/types/database'

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function BrandsPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const supabase = await createClient()

  // Fetch ALL brands in 1000-row chunks (PostgREST caps each response at 1000).
  // BrandsClient handles filtering/search on the full set.
  const brands = await fetchAllRows<Brand>((from, to) =>
    supabase.from('brands').select('*').order('name').range(from, to)
  )

  const initialFilter =
    filter === 'ai_do_not_quote' ? 'ai_dnq' :
    filter === 'confirmed' ? 'confirmed' :
    filter === 'review_due' ? 'review_due' : 'all'

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

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <BrandsClient brands={brands ?? []} initialFilter={initialFilter} />
          </div>
        </div>
      </div>
    </div>
  )
}
