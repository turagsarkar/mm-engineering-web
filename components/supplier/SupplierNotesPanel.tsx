'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils/format'
import { Trash2 } from 'lucide-react'
import type { SupplierNote } from '@/lib/types/database'

interface NoteWithProfile extends SupplierNote {
  profiles: { full_name: string | null; email: string } | null
}

export function SupplierNotesPanel({ supplierId }: { supplierId: string }) {
  const { user, isAdmin } = useUser()
  const { toast } = useToast()
  const [notes, setNotes] = useState<NoteWithProfile[]>([])
  const [text, setText] = useState('')
  const [noteType, setNoteType] = useState('general')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('supplier_notes')
      .select('*, profiles(full_name, email)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
    setNotes((data as NoteWithProfile[]) || [])
  }, [supplierId])

  useEffect(() => { load() }, [load])

  async function addNote() {
    if (!text.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('supplier_notes').insert({
      supplier_id: supplierId,
      note_type: noteType,
      note_text: text.trim(),
      created_by: user?.id,
    })
    if (error) { toast(error.message, 'error') }
    else { setText(''); load() }
    setLoading(false)
  }

  async function deleteNote(id: string) {
    if (!isAdmin) return
    const supabase = createClient()
    await supabase.from('supplier_notes').delete().eq('id', id)
    load()
  }

  const typeColors: Record<string, string> = {
    general: 'bg-gray-100 text-gray-700',
    pricing: 'bg-blue-50 text-blue-700',
    delivery: 'bg-purple-50 text-purple-700',
    warning: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={noteType}
            onChange={e => setNoteType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="general">General</option>
            <option value="pricing">Pricing</option>
            <option value="delivery">Delivery</option>
            <option value="warning">Warning</option>
          </select>
        </div>
        <textarea
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note…"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button size="sm" loading={loading} onClick={addNote} disabled={!text.trim()}>
          Add note
        </Button>
      </div>

      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
        )}
        {notes.map(note => (
          <div key={note.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeColors[note.note_type || 'general']}`}>
                    {note.note_type || 'general'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {note.profiles?.full_name || note.profiles?.email} · {formatDateTime(note.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-800">{note.note_text}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
