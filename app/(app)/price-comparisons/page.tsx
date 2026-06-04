import { TopBar } from '@/components/layout/TopBar'
import { PriceComparisonForm } from '@/components/pricing/PriceComparisonForm'

export default function PriceComparisonsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Price Comparisons" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <p className="text-sm text-gray-500 mb-6">
            Enter a part number, select a brand, and record prices from each non-archived supplier.
          </p>
          <PriceComparisonForm />
        </div>
      </div>
    </div>
  )
}
