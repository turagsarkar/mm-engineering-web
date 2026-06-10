'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Mail, Phone, StickyNote, Edit2, Trash2, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TrafficLightToggle } from '@/components/supplier/TrafficLightToggle'
import { AIApprovedToggle } from '@/components/supplier/AIApprovedToggle'
import { SupplierNotesPanel } from '@/components/supplier/SupplierNotesPanel'
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
  const [showNotes, setShowNotes] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [latestNote, setLatestNote] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .from('supplier_notes')
      .select('note_text')
      .eq('supplier_id', supplier.id)
      .eq('note_type', 'general')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setLatestNote(data.note_text) })
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
            <span className="font-medium text-gray-900 text-sm flex-1 truncate">{supplier.name}</span>
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
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
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

          {/* Row 3: notes preview (shown inline if exists) */}
          {latestNote && (
            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded px-2 py-1 border border-gray-100 line-clamp-2">
              {latestNote}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="All notes"
          >
            <StickyNote className="h-4 w-4" />
          </button>
          <Link
            href={`/suppliers/${supplier.id}/edit`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 -mt-1 border-t-0 rounded-t-none">
          <SupplierNotesPanel supplierId={supplier.id} />
        </div>
      )}

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
