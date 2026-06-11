'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Download, BarChart3 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'

interface ProfileOption { id: string; full_name: string | null; email: string }

interface ActivityRow {
  id: string
  user_id: string | null
  action_type: string
  entity_type: string
  entity_name: string | null
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  brand_added: 'Brands added',
  supplier_added: 'Suppliers added',
  price_comparison_added: 'Price comparisons',
  task_completed: 'Priority tasks completed',
  brand_edited: 'Brands edited',
  supplier_edited: 'Suppliers edited',
  supplier_deleted: 'Suppliers deleted',
  brand_deleted: 'Brands deleted',
  traffic_light_changed: 'Traffic light changes',
  ai_approved_changed: 'AI approval changes',
  points_adjustment: 'Points adjustments',
}

export function ReportsClient({ profiles }: { profiles: ProfileOption[] }) {
  const [filterUser, setFilterUser] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from('activity_log')
      .select('id, user_id, action_type, entity_type, entity_name, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .range(0, 4999)
    if (filterUser) q = q.eq('user_id', filterUser)
    if (from) q = q.gte('created_at', new Date(from).toISOString())
    if (to) q = q.lte('created_at', new Date(to + 'T23:59:59').toISOString())
    const { data } = await q
    setRows((data as ActivityRow[]) || [])
    setRan(true)
    setLoading(false)
  }, [filterUser, from, to])

  // Summary: count by action type
  const summary: Record<string, number> = {}
  for (const r of rows) summary[r.action_type] = (summary[r.action_type] || 0) + 1

  // Summary: per user
  const byUser: Record<string, { name: string; count: number }> = {}
  for (const r of rows) {
    const key = r.user_id || 'system'
    if (!byUser[key]) byUser[key] = { name: r.profiles?.full_name || r.profiles?.email || 'System', count: 0 }
    byUser[key].count++
  }

  function downloadCsv() {
    const header = 'Date,User,Action,Entity Type,Entity Name\n'
    const lines = rows.map(r => [
      new Date(r.created_at).toISOString(),
      `"${(r.profiles?.full_name || r.profiles?.email || 'System').replace(/"/g, '""')}"`,
      r.action_type,
      r.entity_type,
      `"${(r.entity_name || '').replace(/"/g, '""')}"`,
    ].join(','))
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          Report filters
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">User</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">All users</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={run} loading={loading}>Run report</Button>
          {rows.length > 0 && (
            <Button variant="secondary" onClick={downloadCsv}>
              <Download className="h-4 w-4 mr-1.5" />
              Download CSV
            </Button>
          )}
        </div>
      </div>

      {ran && (
        <>
          {/* Summary by action */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
              <div key={action} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ACTION_LABELS[action] || action.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>

          {/* Per-user breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Activity by user ({rows.length} total entries)</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {Object.values(byUser).sort((a, b) => b.count - a.count).map(u => (
                <div key={u.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-900">{u.name}</span>
                  <span className="text-gray-500">{u.count} action{u.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Raw log (latest 100) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Detail (latest 100 — full data in CSV)</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {rows.slice(0, 100).map(r => (
                <div key={r.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <span className="text-gray-400 whitespace-nowrap w-32 shrink-0">{formatDateTime(r.created_at)}</span>
                  <span className="font-medium text-gray-900 w-24 truncate shrink-0">{r.profiles?.full_name || r.profiles?.email || 'System'}</span>
                  <span className="text-gray-600">{(ACTION_LABELS[r.action_type] || r.action_type.replace(/_/g, ' '))}</span>
                  {r.entity_name && <span className="text-gray-400 truncate">— {r.entity_name}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
