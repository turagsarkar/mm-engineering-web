import { TopBar } from '@/components/layout/TopBar'
import { SupplierForm } from '@/components/supplier/SupplierForm'

interface Props {
  searchParams: Promise<{ brand_id?: string; brand_slug?: string }>
}

export default async function NewSupplierPage({ searchParams }: Props) {
  const { brand_id, brand_slug } = await searchParams

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Add Supplier" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-6">New supplier</h2>
            <SupplierForm brandId={brand_id} brandSlug={brand_slug} />
          </div>
        </div>
      </div>
    </div>
  )
}
