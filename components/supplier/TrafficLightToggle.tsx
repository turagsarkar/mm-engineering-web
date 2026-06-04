'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import type { TrafficLight } from '@/lib/types/app'

const CYCLE: TrafficLight[] = ['green', 'amber', 'red']

const colors: Record<NonNullable<TrafficLight>, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}

interface TrafficLightToggleProps {
  supplierId: string
  value: TrafficLight
  onChange: (v: TrafficLight) => void
}

export function TrafficLightToggle({ supplierId, value, onChange }: TrafficLightToggleProps) {
  const { isAdmin, user } = useUser()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const current: TrafficLight = value ?? 'green'
  const currentIndex = CYCLE.indexOf(current)
  const next: TrafficLight = CYCLE[(currentIndex + 1) % CYCLE.length]

  async function cycle() {
    if (!isAdmin || loading) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('suppliers')
      .update({ traffic_light: next })
      .eq('id', supplierId)
    if (error) { toast(error.message, 'error') }
    else {
      onChange(next)
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action_type: 'traffic_light_changed',
        entity_type: 'supplier',
        entity_id: supplierId,
        details: { from: current, to: next },
      })
    }
    setLoading(false)
  }

  return (
    <button
      onClick={cycle}
      disabled={!isAdmin || loading}
      title={isAdmin ? `Click to change to ${next}` : `Traffic light: ${current}`}
      className={`w-3.5 h-3.5 rounded-full transition-opacity ${colors[current as NonNullable<TrafficLight>] || 'bg-green-500'} ${
        isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
      } ${loading ? 'opacity-50' : ''}`}
    />
  )
}
