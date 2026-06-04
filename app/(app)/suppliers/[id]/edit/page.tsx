import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { SupplierForm } from '@/components/supplier/SupplierForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditSupplierPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (!supplier) notFound()

  const { data: brand } = await supabase
    .from('brands')
    .select('slug')
    .eq('id', supplier.brand_id)
    .single()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={`Edit — ${supplier.name}`} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Edit supplier</h2>
            <SupplierForm supplier={supplier} brandSlug={brand?.slug} />
          </div>
        </div>
      </div>
    </div>
  )
}
