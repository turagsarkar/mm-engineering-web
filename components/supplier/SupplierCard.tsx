'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Mail, User, Edit2, Trash2, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TrafficLightToggle } from '@/components/supplier/TrafficLightToggle'
import { AIApprovedToggle } from '@/components/supplier/AIApprovedToggle'
import { Modal } from '@/components/ui/Modal'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import type { TrafficLight } from '@/lib/types/app'
import type { Supplier } from '@/lib/types/database'

interface SupplierCardProps {
  supplier: Supplier
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<Supplier>) => void
}

export function SupplierCard({ supplier, onDelete, onUpdate }: SupplierCardProps) {
  const { isAdmin } = useUser()
  const { toast } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [latestNote, setLatestNote] = useState<string | null>(null)

  // Show the latest note of any type (form manages notes as a single field)
  useEffect(() => {
    createClient()
      .from('supplier_notes')
      .select('note_text')
      .eq('supplier_id', supplier.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => { setLatestNote(data && data.length > 0 ? data[0].note_text : null) })
  }, [supplier.id])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: supplier.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function copyEmail() {
    if (!supplier.email) return
    await navigator.clipboard.writeText(supplier.email)
    toast('Email copied', 'info')
  }

  async function handleDelete() {
    const supabase = createClient()
    await supabase.from('suppliers').delete().eq('id', supplier.id)
    onDelete(supplier.id)
    setConfirmDelete(false)
    toast('Supplier deleted', 'success')
  }

  return (
    <>
      <div ref={setNodeRef} style={style} className="bg-white rounded-lg border border-gray-200 p-4 flex gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Row 1: traffic light + name + toggles */}
          <div className="flex items-center gap-2 mb-1">
            <TrafficLightToggle
              supplierId={supplier.id}
              value={supplier.traffic_light as TrafficLight}
              onChange={v => onUpdate(supplier.id, { traffic_light: v })}
            />
            <Link href={`/suppliers/${supplier.id}`} className="font-medium text-gray-900 text-sm flex-1 truncate hover:text-blue-600 transition-colors">
              {supplier.name}
            </Link>
            <AIApprovedToggle
              supplierId={supplier.id}
              value={supplier.ai_approved}
              onChange={v => onUpdate(supplier.id, { ai_approved: v })}
            />
            {supplier.review_required && (
              <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded font-medium">
                Review
              </span>
            )}
          </div>

          {/* Row 2: email, contact, margin, where_to_look, po */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mt-0.5">
            {supplier.email && (
              <button
                onClick={copyEmail}
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                title="Click to copy"
              >
                <Mail className="h-3 w-3" />
                {supplier.email}
              </button>
            )}
            {supplier.contact_name && (
              <span className="flex items-center gap-1" title="Contact name">
                <User className="h-3 w-3" />
                {supplier.contact_name}
              </span>
            )}
            {supplier.margin && (
              <span className="font-medium text-gray-700">Margin: {supplier.margin}</span>
            )}
            {supplier.where_to_look && (
              <span className="text-gray-400 truncate max-w-[8rem] sm:max-w-none">{supplier.where_to_look}</span>
            )}
            {supplier.po_number && (
              <span>PO: {supplier.po_number}</span>
            )}
          </div>

          {/* Notes — styled to stand out from the other details */}
          {latestNote && (
            <div className="flex items-start gap-1.5 mt-2 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md px-2.5 py-1.5">
              <StickyNote className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-yellow-900">{latestNote}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/suppliers/${supplier.id}/edit`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit (notes are edited here)"
          >
            <Edit2 className="h-4 w-4" />
          </Link>
          {isAdmin && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete (admin only)"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete supplier" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{supplier.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  )
}
