'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'

interface LeaderEntry {
  user_id: string | null
  full_name: string | null
  email: string | null
  count: number
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('activity_log')
      .select('user_id, profiles(full_name, email)')
      .in('action_type', ['brand_added', 'supplier_added'])
      .not('user_id', 'is', null)

    if (!data) return

    const counts: Record<string, LeaderEntry> = {}
    for (const row of data as { user_id: string | null; profiles: { full_name: string | null; email: string } | null }[]) {
      if (!row.user_id) continue
      if (!counts[row.user_id]) {
        counts[row.user_id] = {
          user_id: row.user_id,
          full_name: row.profiles?.full_name ?? null,
          email: row.profiles?.email ?? null,
          count: 0,
        }
      }
      counts[row.user_id].count++
    }
    setEntries(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10))
  }, [])

  useEffect(() => { load() }, [load])
  useRealtimeChannel('leaderboard', 'activity_log', load)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-gray-900">Leaderboard</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No data yet</p>
        ) : (
          entries.map((e, i) => (
            <div key={e.user_id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-base w-6 text-center">{medals[i] || `#${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {e.full_name || e.email}
                </p>
              </div>
              <span className="text-sm font-semibold text-blue-600">{e.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
