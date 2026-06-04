import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BrandForm } from '@/components/brand/BrandForm'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditBrandPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!brand) notFound()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={`Edit — ${brand.name}`} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Edit brand</h2>
            <BrandForm brand={brand} />
          </div>
        </div>
      </div>
    </div>
  )
}
