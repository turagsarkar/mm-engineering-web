'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, ChevronDown } from 'lucide-react'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'

interface LeaderEntry {
  user_id: string
  full_name: string | null
  email: string | null
  points: number
  breakdown: { suppliers: number; brands: number; comparisons: number; tasks: number }
}

type FilterType = 'all' | 'suppliers' | 'brands' | 'comparisons' | 'tasks'
type FilterPeriod = '1w' | '1m' | 'custom' | 'all'

const POINTS: Record<string, number> = {
  supplier_added: 1,
  brand_added: 1,
  price_comparison_added: 2,
  task_completed: 3,
}

const TYPE_ACTIONS: Record<FilterType, string[]> = {
  all: ['supplier_added', 'brand_added', 'price_comparison_added', 'task_completed'],
  suppliers: ['supplier_added'],
  brands: ['brand_added'],
  comparisons: ['price_comparison_added'],
  tasks: ['task_completed'],
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All activity',
  suppliers: 'Suppliers added',
  brands: 'Brands added',
  comparisons: 'Price comparisons',
  tasks: 'Priority tasks',
}

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  all: 'All time',
  '1w': '1 week',
  '1m': '1 month',
  custom: 'Custom',
}

function getPeriodStart(period: FilterPeriod, customFrom: string): string | null {
  if (period === 'all') return null
  if (period === '1w') {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString()
  }
  if (period === '1m') {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString()
  }
  if (period === 'custom' && customFrom) return new Date(customFrom).toISOString()
  return null
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('1m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const actions = TYPE_ACTIONS[filterType]
    const fromDate = getPeriodStart(filterPeriod, customFrom)

    let q = supabase
      .from('activity_log')
      .select('user_id, action_type, profiles(full_name, email)')
      .in('action_type', actions)
      .not('user_id', 'is', null)

    if (fromDate) q = q.gte('created_at', fromDate)
    if (filterPeriod === 'custom' && customTo) q = q.lte('created_at', new Date(customTo + 'T23:59:59').toISOString())

    const { data } = await q
    if (!data) return

    const counts: Record<string, LeaderEntry> = {}
    for (const row of data as { user_id: string | null; action_type: string; profiles: { full_name: string | null; email: string } | null }[]) {
      if (!row.user_id) continue
      if (!counts[row.user_id]) {
        counts[row.user_id] = {
          user_id: row.user_id,
          full_name: row.profiles?.full_name ?? null,
          email: row.profiles?.email ?? null,
          points: 0,
          breakdown: { suppliers: 0, brands: 0, comparisons: 0, tasks: 0 },
        }
      }
      const pts = POINTS[row.action_type] ?? 1
      counts[row.user_id].points += pts
      if (row.action_type === 'supplier_added') counts[row.user_id].breakdown.suppliers++
      if (row.action_type === 'brand_added') counts[row.user_id].breakdown.brands++
      if (row.action_type === 'price_comparison_added') counts[row.user_id].breakdown.comparisons++
      if (row.action_type === 'task_completed') counts[row.user_id].breakdown.tasks++
    }
    setEntries(Object.values(counts).sort((a, b) => b.points - a.points).slice(0, 10))
  }, [filterType, filterPeriod, customFrom, customTo])

  useEffect(() => { load() }, [load])
  useRealtimeChannel('leaderboard', 'activity_log', load)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-gray-900">Leaderboard</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {PERIOD_LABELS[filterPeriod]} · {FILTER_LABELS[filterType]}
          <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-3">
          {/* Activity type filter */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Activity type</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(FILTER_LABELS) as FilterType[]).map(k => (
                <button
                  key={k}
                  onClick={() => setFilterType(k)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    filterType === k
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {FILTER_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Time period filter */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Time period</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map(k => (
                <button
                  key={k}
                  onClick={() => setFilterPeriod(k)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    filterPeriod === k
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {PERIOD_LABELS[k]}
                </button>
              ))}
            </div>
            {filterPeriod === 'custom' && (
              <div className="flex gap-2 mt-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-xs text-gray-500">From</label>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-xs text-gray-500">To</label>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Points legend */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex gap-3 flex-wrap">
        <span className="text-xs text-blue-600">1pt supplier/brand</span>
        <span className="text-xs text-blue-600">2pts comparison</span>
        <span className="text-xs text-blue-600">3pts task</span>
      </div>

      <div className="divide-y divide-gray-50">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No data for this filter</p>
        ) : (
          entries.map((e, i) => (
            <div key={e.user_id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-base w-6 text-center shrink-0">{medals[i] || `#${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {e.full_name || e.email}
                </p>
                <p className="text-xs text-gray-400">
                  {[
                    e.breakdown.suppliers > 0 && `${e.breakdown.suppliers}S`,
                    e.breakdown.brands > 0 && `${e.breakdown.brands}B`,
                    e.breakdown.comparisons > 0 && `${e.breakdown.comparisons}PC`,
                    e.breakdown.tasks > 0 && `${e.breakdown.tasks}T`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="text-sm font-bold text-blue-600 shrink-0">{e.points}pt</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
