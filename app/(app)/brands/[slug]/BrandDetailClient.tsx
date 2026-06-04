'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
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
import type { Brand, Supplier } from '@/lib/types/database'

interface Props {
  brand: Brand
  initialSuppliers: Supplier[]
}

export function BrandDetailClient({ brand: initialBrand, initialSuppliers }: Props) {
  const [brand, setBrand] = useState(initialBrand)
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const { toast } = useToast()

  const active = suppliers.filter(s => s.traffic_light !== 'red' && s.supplier_status !== 'inactive')
  const archived = suppliers.filter(s => s.traffic_light === 'red' || s.supplier_status === 'inactive')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event
    if (!over || dragActive.id === over.id) return

    const oldIndex = suppliers.findIndex(s => s.id === dragActive.id)
    const newIndex = suppliers.findIndex(s => s.id === over.id)
    const reordered = arrayMove(suppliers, oldIndex, newIndex)
    setSuppliers(reordered)

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
      setSuppliers(suppliers)
    }
  }

  function handleDelete(id: string) {
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  function handleUpdate(id: string, patch: Partial<Supplier>) {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <BrandHeader brand={brand} onUpdate={p => setBrand(prev => ({ ...prev, ...p }))} />

      {/* Supplier section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Suppliers ({active.length})
        </h3>
        <Link
          href={`/suppliers/new?brand_id=${brand.id}&brand_slug=${brand.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add supplier
        </Link>
      </div>

      {/* Active suppliers — sortable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {active.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-400 text-sm">No active suppliers for this brand</p>
                <Link
                  href={`/suppliers/new?brand_id=${brand.id}&brand_slug=${brand.slug}`}
                  className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline"
                >
                  Add the first supplier
                </Link>
              </div>
            ) : (
              active.map(s => (
                <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} onUpdate={handleUpdate} />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Archived section */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setArchivedOpen(!archivedOpen)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-2"
          >
            {archivedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Archived / Red light ({archived.length})
          </button>
          {archivedOpen && (
            <div className="space-y-2 opacity-60">
              {archived.map(s => (
                <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} onUpdate={handleUpdate} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
