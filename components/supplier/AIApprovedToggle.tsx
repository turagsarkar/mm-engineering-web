'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AIApprovedToggleProps {
  supplierId: string
  value: boolean
  onChange: (v: boolean) => void
}

export function AIApprovedToggle({ supplierId, value, onChange }: AIApprovedToggleProps) {
  const { isAdmin, user } = useUser()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!isAdmin || loading) return
    setLoading(true)
    const next = !value
    const supabase = createClient()
    const { error } = await supabase
      .from('suppliers')
      .update({ ai_approved: next })
      .eq('id', supplierId)
    if (error) { toast(error.message, 'error') }
    else {
      onChange(next)
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action_type: 'ai_approved_changed',
        entity_type: 'supplier',
        entity_id: supplierId,
        details: { ai_approved: next },
      })
      toast(`AI ${next ? 'approved' : 'unapproved'}`, 'success')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={!isAdmin || loading}
      title={isAdmin ? `Click to ${value ? 'unapprove' : 'approve'} for AI` : `AI: ${value ? 'Approved' : 'Not approved'}`}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded transition-colors',
        value
          ? 'bg-green-50 text-green-700 border border-green-300'
          : 'bg-gray-100 text-gray-400 border border-gray-200',
        isAdmin && !loading && 'hover:opacity-80 cursor-pointer',
        !isAdmin && 'cursor-default',
        loading && 'opacity-50'
      )}
    >
      <Bot className="h-3 w-3" />
      {value ? 'AI OK' : 'No AI'}
    </button>
  )
}
