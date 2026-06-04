'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeChannel(
  channel: string,
  table: string,
  onEvent: () => void
) {
  useEffect(() => {
    const supabase = createClient()
    const sub = supabase
      .channel(channel)
      .on('postgres_changes', { event: '*', schema: 'public', table }, onEvent)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [channel, table, onEvent])
}
