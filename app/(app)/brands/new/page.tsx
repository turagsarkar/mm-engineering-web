import { TopBar } from '@/components/layout/TopBar'
import { BrandForm } from '@/components/brand/BrandForm'

export default async function NewBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const { name } = await searchParams
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Add Brand" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-6">New brand</h2>
            <BrandForm initialName={name} />
          </div>
        </div>
      </div>
    </div>
  )
}
