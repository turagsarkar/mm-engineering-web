'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronDown, ChevronRight, BarChart2, ExternalLink } from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import { BrandHeader } from '@/components/brand/BrandHeader'
import { SupplierCard } from '@/components/supplier/SupplierCard'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'
import type { Brand, Supplier } from '@/lib/types/database'

interface PriceComparisonRow {
  id: string
  part_number: string
  description: string | null
  created_at: string
  created_by: string | null
}

interface Props {
  brand: Brand
  initialSuppliers: Supplier[]
  initialPriceComparisons: PriceComparisonRow[]
}

type Tab = 'green' | 'all' | 'prices'

const TL_ORDER: Record<string, number> = { green: 0, amber: 1, red: 2 }

export function BrandDetailClient({ brand: initialBrand, initialSuppliers, initialPriceComparisons }: Props) {
  const [brand, setBrand] = useState(initialBrand)
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [priceComparisons] = useState(initialPriceComparisons)
  const [activeTab, setActiveTab] = useState<Tab>('green')
  const [archivedOpen, setArchivedOpen] = useState(false)
  const { toast } = useToast()

  const greenSuppliers = suppliers
    .filter(s => s.traffic_light === 'green' && s.supplier_status !== 'inactive')
    .sort((a, b) => (TL_ORDER[a.traffic_light ?? ''] ?? 0) - (TL_ORDER[b.traffic_light ?? ''] ?? 0) || a.priority_rank - b.priority_rank)

  const activeSuppliers = suppliers
    .filter(s => s.supplier_status !== 'inactive')
    .sort((a, b) => (TL_ORDER[a.traffic_light ?? ''] ?? 2) - (TL_ORDER[b.traffic_light ?? ''] ?? 2) || a.priority_rank - b.priority_rank)

  const inactiveSuppliers = suppliers.filter(s => s.supplier_status === 'inactive')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event
    if (!over || dragActive.id === over.id) return

    const currentList = activeTab === 'green' ? greenSuppliers : activeSuppliers
    const oldIndex = currentList.findIndex(s => s.id === dragActive.id)
    const newIndex = currentList.findIndex(s => s.id === over.id)
    const reordered = arrayMove(currentList, oldIndex, newIndex)

    setSuppliers(prev => {
      const ids = new Set(reordered.map(s => s.id))
      const unchanged = prev.filter(s => !ids.has(s.id))
      return [...reordered.map((s, i) => ({ ...s, priority_rank: i })), ...unchanged]
    })

    const supabase = createClient()
    try {
      await Promise.all(
        reordered.map((s, i) =>
          supabase.from('suppliers').update({ priority_rank: i }).eq('id', s.id)
        )
      )
      toast('Order saved', 'success')
    } catch {
      toast('Failed to save order', 'error')
      setSuppliers(initialSuppliers)
    }
  }

  function handleDelete(id: string) {
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  function handleUpdate(id: string, patch: Partial<Supplier>) {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const tabList: { id: Tab; label: string; count: number }[] = [
    { id: 'green', label: 'Green Suppliers', count: greenSuppliers.length },
    { id: 'all', label: 'All Suppliers', count: activeSuppliers.length },
    { id: 'prices', label: 'Price Comparisons', count: priceComparisons.length },
  ]

  const addSupplierHref = `/suppliers/new?brand_id=${brand.id}&brand_slug=${brand.slug}`

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <BrandHeader brand={brand} onUpdate={p => setBrand(prev => ({ ...prev, ...p }))} />

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200">
        {tabList.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Green Suppliers tab */}
      {activeTab === 'green' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing only green (priority) suppliers</p>
            <Link href={addSupplierHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add supplier
            </Link>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={greenSuppliers.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {greenSuppliers.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-400 text-sm">No green suppliers yet</p>
                    <Link href={addSupplierHref} className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline">
                      Add the first supplier
                    </Link>
                  </div>
                ) : (
                  greenSuppliers.map(s => (
                    <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} onUpdate={handleUpdate} />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* All Suppliers tab */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">All active suppliers grouped by traffic light</p>
            <Link href={addSupplierHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add supplier
            </Link>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeSuppliers.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {activeSuppliers.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-400 text-sm">No active suppliers for this brand</p>
                    <Link href={addSupplierHref} className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline">
                      Add the first supplier
                    </Link>
                  </div>
                ) : (
                  activeSuppliers.map(s => (
                    <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} onUpdate={handleUpdate} />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>

          {inactiveSuppliers.length > 0 && (
            <div>
              <button
                onClick={() => setArchivedOpen(!archivedOpen)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-2"
              >
                {archivedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Inactive / Archived ({inactiveSuppliers.length})
              </button>
              {archivedOpen && (
                <div className="space-y-2 opacity-60">
                  {inactiveSuppliers.map(s => (
                    <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} onUpdate={handleUpdate} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Price Comparisons tab */}
      {activeTab === 'prices' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{priceComparisons.length} comparison{priceComparisons.length !== 1 ? 's' : ''} recorded</p>
            <Link
              href="/price-comparisons"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" /> New comparison
            </Link>
          </div>

          {priceComparisons.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-400 text-sm">No price comparisons yet for this brand</p>
              <Link href="/price-comparisons" className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline">
                Add the first comparison
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {priceComparisons.map(pc => (
                  <PriceComparisonRow key={pc.id} comparison={pc} brandId={brand.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PriceComparisonRow({ comparison, brandId }: { comparison: PriceComparisonRow; brandId: string }) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<{ id: string; supplier_name: string | null; price: number | null; lead_time: string | null; notes: string | null }[]>([])
  const [loaded, setLoaded] = useState(false)

  async function loadLines() {
    if (loaded) { setOpen(!open); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('price_comparison_lines')
      .select('id, supplier_name, price, lead_time, notes')
      .eq('comparison_id', comparison.id)
      .order('price', { ascending: true })
    setLines(data || [])
    setLoaded(true)
    setOpen(true)
  }

  return (
    <div>
      <button
        onClick={loadLines}
        className="flex items-center gap-4 w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 font-mono">{comparison.part_number}</p>
          {comparison.description && (
            <p className="text-xs text-gray-500 truncate">{comparison.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(comparison.created_at)}</span>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {open && lines.length > 0 && (
        <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1 font-medium">Supplier</th>
                <th className="text-left py-1 font-medium">Price</th>
                <th className="text-left py-1 font-medium">Lead time</th>
                <th className="text-left py-1 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map(line => (
                <tr key={line.id}>
                  <td className="py-1.5 font-medium text-gray-900">{line.supplier_name}</td>
                  <td className="py-1.5 text-gray-700">{line.price != null ? line.price : '—'}</td>
                  <td className="py-1.5 text-gray-500">{line.lead_time || '—'}</td>
                  <td className="py-1.5 text-gray-400 truncate max-w-[12rem]">{line.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
