'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronRight, BarChart2, Trash2, Pencil, X, Check } from 'lucide-react'
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
import { useUser } from '@/lib/hooks/useUser'
import { formatDateTime } from '@/lib/utils/format'
import type { Brand, Supplier } from '@/lib/types/database'

interface PriceComparisonHeader {
  id: string
  part_number: string
  description: string | null
  created_at: string
  created_by: string | null
}

interface Props {
  brand: Brand
  initialSuppliers: Supplier[]
  initialPriceComparisons: PriceComparisonHeader[]
}

type Tab = 'green' | 'amber' | 'red' | 'prices'

export function BrandDetailClient({ brand: initialBrand, initialSuppliers, initialPriceComparisons }: Props) {
  const [brand, setBrand] = useState(initialBrand)
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [priceComparisons, setPriceComparisons] = useState(initialPriceComparisons)
  const [activeTab, setActiveTab] = useState<Tab>('green')
  const { toast } = useToast()

  const byLight = (light: string) =>
    suppliers
      .filter(s => (s.traffic_light ?? 'green') === light)
      .sort((a, b) => a.priority_rank - b.priority_rank || a.name.localeCompare(b.name))

  const greenSuppliers = byLight('green')
  const amberSuppliers = byLight('amber')
  const redSuppliers = byLight('red')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event
    if (!over || dragActive.id === over.id) return

    const currentList =
      activeTab === 'green' ? greenSuppliers :
      activeTab === 'amber' ? amberSuppliers : redSuppliers
    const oldIndex = currentList.findIndex(s => s.id === dragActive.id)
    const newIndex = currentList.findIndex(s => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
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

  const tabList: { id: Tab; label: string; dot?: string; count: number }[] = [
    { id: 'green', label: 'Green – Primary', dot: 'bg-green-500', count: greenSuppliers.length },
    { id: 'amber', label: 'Amber – Alternative/Stock', dot: 'bg-amber-400', count: amberSuppliers.length },
    { id: 'red', label: 'Red – Do Not Use', dot: 'bg-red-500', count: redSuppliers.length },
    { id: 'prices', label: 'Price Comparisons', count: priceComparisons.length },
  ]

  const addSupplierHref = `/suppliers/new?brand_id=${brand.id}&brand_slug=${brand.slug}`

  function renderSupplierList(list: Supplier[], emptyText: string) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Link href={addSupplierHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add supplier
          </Link>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={list.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {list.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-400 text-sm">{emptyText}</p>
                  <Link href={addSupplierHref} className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline">
                    Add a supplier
                  </Link>
                </div>
              ) : (
                list.map(s => (
                  <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} onUpdate={handleUpdate} />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <BrandHeader brand={brand} onUpdate={p => setBrand(prev => ({ ...prev, ...p }))} />

      {/* Traffic light key */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center gap-4 flex-wrap text-xs text-gray-600">
        <span className="font-semibold text-gray-700">Key:</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Green – Primary Supplier</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Amber – Alternative/Stock Supplier</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Red – Do Not Use</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 overflow-x-auto">
        {tabList.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.dot && <span className={`w-2.5 h-2.5 rounded-full ${t.dot} shrink-0`} />}
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'green' && renderSupplierList(greenSuppliers, 'No green (primary) suppliers yet')}
      {activeTab === 'amber' && renderSupplierList(amberSuppliers, 'No amber (alternative/stock) suppliers')}
      {activeTab === 'red' && renderSupplierList(redSuppliers, 'No red (do not use) suppliers')}

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
                  <ComparisonRow
                    key={pc.id}
                    comparison={pc}
                    onDeleted={id => setPriceComparisons(prev => prev.filter(p => p.id !== id))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ComparisonLine {
  id: string
  supplier_name: string | null
  price: number | null
  lead_time: string | null
  response_time: string | null
  notes: string | null
}

function ComparisonRow({ comparison, onDeleted }: {
  comparison: PriceComparisonHeader
  onDeleted: (id: string) => void
}) {
  const { isAdmin } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<ComparisonLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [draft, setDraft] = useState({ price: '', lead_time: '', notes: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function loadLines() {
    if (loaded) { setOpen(!open); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('price_comparison_lines')
      .select('id, supplier_name, price, lead_time, response_time, notes')
      .eq('comparison_id', comparison.id)
      .order('price', { ascending: true })
    setLines(data || [])
    setLoaded(true)
    setOpen(true)
  }

  function startEdit(line: ComparisonLine) {
    setEditingLine(line.id)
    setDraft({
      price: line.price != null ? String(line.price) : '',
      lead_time: line.lead_time || '',
      notes: line.notes || '',
    })
  }

  async function saveEdit(lineId: string) {
    const res = await fetch('/api/comparisons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_id: lineId, price: draft.price, lead_time: draft.lead_time, notes: draft.notes }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast(json.error || 'Failed to save', 'error')
      return
    }
    setLines(prev => prev.map(l => l.id === lineId ? {
      ...l,
      price: draft.price === '' || isNaN(parseFloat(draft.price)) ? null : parseFloat(draft.price),
      lead_time: draft.lead_time || null,
      notes: draft.notes || null,
    } : l))
    setEditingLine(null)
    toast('Line updated', 'success')
  }

  async function deleteComparison() {
    const res = await fetch('/api/comparisons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comparison_id: comparison.id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast(json.error || 'Failed to delete', 'error')
      return
    }
    toast('Comparison deleted', 'success')
    onDeleted(comparison.id)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
        <button onClick={loadLines} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 font-mono">{comparison.part_number}</p>
            {comparison.description && (
              <p className="text-xs text-gray-500 truncate">{comparison.description}</p>
            )}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(comparison.created_at)}</span>
          {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        </button>
        {isAdmin && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
            title="Delete comparison (admin only)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {isAdmin && confirmDelete && (
          <span className="flex items-center gap-1 shrink-0">
            <button onClick={deleteComparison} className="text-xs font-medium text-white bg-red-600 px-2 py-1 rounded hover:bg-red-700">
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">
              Cancel
            </button>
          </span>
        )}
      </div>

      {open && lines.length > 0 && (
        <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1 font-medium">Supplier</th>
                <th className="text-left py-1 font-medium">Price</th>
                <th className="text-left py-1 font-medium">Lead time</th>
                <th className="text-left py-1 font-medium">Notes</th>
                <th className="py-1 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map(line => (
                <tr key={line.id}>
                  {editingLine === line.id ? (
                    <>
                      <td className="py-1.5 font-medium text-gray-900">{line.supplier_name}</td>
                      <td className="py-1.5 pr-2">
                        <input value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
                          className="w-20 border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input value={draft.lead_time} onChange={e => setDraft(d => ({ ...d, lead_time: e.target.value }))}
                          className="w-24 border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="py-1.5">
                        <span className="flex items-center gap-1">
                          <button onClick={() => saveEdit(line.id)} className="text-green-600 hover:text-green-700" title="Save">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingLine(null)} className="text-gray-400 hover:text-gray-600" title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 font-medium text-gray-900">{line.supplier_name}</td>
                      <td className="py-1.5 text-gray-700">{line.price != null ? line.price : '—'}</td>
                      <td className="py-1.5 text-gray-500">{line.lead_time || '—'}</td>
                      <td className="py-1.5 text-gray-400 truncate max-w-[12rem]">{line.notes || '—'}</td>
                      <td className="py-1.5">
                        <button onClick={() => startEdit(line)} className="text-gray-300 hover:text-blue-600" title="Edit line">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
