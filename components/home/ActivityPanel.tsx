'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils/format'
import { Activity, Filter, X } from 'lucide-react'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'

interface ActivityItem {
  id: string
  action_type: string
  entity_type: string
  entity_name: string | null
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

interface ProfileOption { id: string; full_name: string | null; email: string }

export function ActivityPanel() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [filterUser, setFilterUser] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => {
    createClient().from('profiles').select('id, full_name, email').order('full_name').then(({ data }) => setProfiles(data || []))
  }, [])

  const load = useCallback(async () => {
    const supabase = createClient()
    let q = supabase
      .from('activity_log')
      .select('id, action_type, entity_type, entity_name, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(30)
    if (filterUser) q = q.eq('user_id', filterUser)
    if (filterFrom) q = q.gte('created_at', new Date(filterFrom).toISOString())
    if (filterTo) q = q.lte('created_at', new Date(filterTo + 'T23:59:59').toISOString())
    const { data } = await q
    setItems((data as ActivityItem[]) || [])
  }, [filterUser, filterFrom, filterTo])

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
    price_comparison_added: 'Completed price comparison',
    task_completed: 'Completed priority task',
    points_adjustment: 'Points adjusted',
  }

  const hasFilter = filterUser || filterFrom || filterTo

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Activity className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`ml-auto flex items-center gap-1 text-xs transition-colors ${
            hasFilter ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Filter className="h-3 w-3" />
          {hasFilter ? 'Filtered' : 'Filter'}
        </button>
      </div>

      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">User</label>
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">All users</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          {hasFilter && (
            <button
              onClick={() => { setFilterUser(''); setFilterFrom(''); setFilterTo('') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No activity {hasFilter ? 'for this filter' : 'yet'}</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="px-4 py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">
                    {item.profiles?.full_name || item.profiles?.email || 'System'}
                  </span>{' '}
                  {actionLabel[item.action_type] || item.action_type.replace(/_/g, ' ')}
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
