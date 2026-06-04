'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils/format'
import { Activity } from 'lucide-react'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'

interface ActivityItem {
  id: string
  action_type: string
  entity_type: string
  entity_name: string | null
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

export function ActivityPanel() {
  const [items, setItems] = useState<ActivityItem[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('activity_log')
      .select('id, action_type, entity_type, entity_name, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data as ActivityItem[]) || [])
  }, [])

  useEffect(() => { load() }, [load])
  useRealtimeChannel('activity-panel', 'activity_log', load)

  const actionLabel: Record<string, string> = {
    brand_added: 'Added brand',
    brand_edited: 'Edited brand',
    brand_deleted: 'Deleted brand',
    supplier_added: 'Added supplier',
    supplier_edited: 'Edited supplier',
    supplier_deleted: 'Deleted supplier',
    traffic_light_changed: 'Changed traffic light',
    ai_approved_changed: 'Changed AI approval',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Activity className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
      </div>
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No activity yet</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="px-4 py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">
                    {item.profiles?.full_name || item.profiles?.email || 'System'}
                  </span>{' '}
                  {actionLabel[item.action_type] || item.action_type}
                  {item.entity_name && (
                    <span className="text-gray-500"> — {item.entity_name}</span>
                  )}
                </p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                {timeAgo(item.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
