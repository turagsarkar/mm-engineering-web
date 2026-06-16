'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface LeaderEntry {
  user_id: string
  full_name: string | null
  email: string | null
  points: number
  breakdown: { suppliers: number; brands: number; comparisons: number; tasks: number; adjustments: number }
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
  all: ['supplier_added', 'brand_added', 'price_comparison_added', 'task_completed', 'points_adjustment'],
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
  const { isAdmin } = useUser()
  const { toast } = useToast()
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('1m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [adjustFor, setAdjustFor] = useState<LeaderEntry | null>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const actions = TYPE_ACTIONS[filterType]
    const fromDate = getPeriodStart(filterPeriod, customFrom)

    let q = supabase
      .from('activity_log')
      .select('user_id, action_type, details, profiles(full_name, email)')
      .in('action_type', actions)
      .not('user_id', 'is', null)

    if (fromDate) q = q.gte('created_at', fromDate)
    if (filterPeriod === 'custom' && customTo) q = q.lte('created_at', new Date(customTo + 'T23:59:59').toISOString())

    const { data } = await q
    if (!data) return

    const counts: Record<string, LeaderEntry> = {}
    for (const row of data as { user_id: string | null; action_type: string; details: { points?: number } | null; profiles: { full_name: string | null; email: string } | null }[]) {
      if (!row.user_id) continue
      if (!counts[row.user_id]) {
        counts[row.user_id] = {
          user_id: row.user_id,
          full_name: row.profiles?.full_name ?? null,
          email: row.profiles?.email ?? null,
          points: 0,
          breakdown: { suppliers: 0, brands: 0, comparisons: 0, tasks: 0, adjustments: 0 },
        }
      }
      const e = counts[row.user_id]
      if (row.action_type === 'points_adjustment') {
        const pts = row.details?.points ?? 0
        e.points += pts
        e.breakdown.adjustments += pts
      } else {
        e.points += POINTS[row.action_type] ?? 1
        if (row.action_type === 'supplier_added') e.breakdown.suppliers++
        if (row.action_type === 'brand_added') e.breakdown.brands++
        if (row.action_type === 'price_comparison_added') e.breakdown.comparisons++
        if (row.action_type === 'task_completed') e.breakdown.tasks++
      }
    }
    setEntries(Object.values(counts).sort((a, b) => b.points - a.points).slice(0, 10))
  }, [filterType, filterPeriod, customFrom, customTo])

  useEffect(() => { load() }, [load])
  useRealtimeChannel('leaderboard', 'activity_log', load)

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustFor || !adjustPoints) return
    setAdjustLoading(true)
    const res = await fetch('/api/admin/adjust-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: adjustFor.user_id, points: adjustPoints, reason: adjustReason }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast(json.error || 'Failed to adjust points', 'error')
    } else {
      toast('Points adjusted', 'success')
      setAdjustFor(null); setAdjustPoints(''); setAdjustReason('')
      load()
    }
    setAdjustLoading(false)
  }

  // Line 1: suppliers · brands (if any) · comparisons
  function breakdownLine1(e: LeaderEntry): string {
    const b = e.breakdown
    const parts: string[] = [`${b.suppliers} supplier${b.suppliers !== 1 ? 's' : ''}`]
    if (b.brands > 0) parts.push(`${b.brands} brand${b.brands !== 1 ? 's' : ''}`)
    parts.push(`${b.comparisons} comparison${b.comparisons !== 1 ? 's' : ''}`)
    return parts.join(' · ')
  }

  // Line 2: priority task count, plus any manual adjustment
  function breakdownLine2(e: LeaderEntry): string {
    const b = e.breakdown
    let line = `${b.tasks} priority task${b.tasks !== 1 ? 's' : ''}`
    if (b.adjustments !== 0) {
      line += `      ${b.adjustments > 0 ? '+' : ''}${b.adjustments} adjustment`
    }
    return line
  }

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
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex gap-4 flex-wrap">
        <span className="text-xs font-medium text-blue-700">+1 Supplier/Brand</span>
        <span className="text-xs font-medium text-blue-700">+2 Price Comparison</span>
        <span className="text-xs font-medium text-blue-700">+3 Priority Task</span>
      </div>

      <div className="divide-y divide-gray-50">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No data for this filter</p>
        ) : (
          entries.map((e, i) => (
            <div key={e.user_id} className="flex items-start gap-3 px-4 py-3">
              <span className="text-base w-6 text-center shrink-0 mt-0.5">{medals[i] || `#${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.full_name || e.email}</p>
                  <span className="text-sm font-bold text-blue-600 shrink-0">{e.points} pts</span>
                </div>
                {/* Line 1: suppliers · brands · comparisons */}
                <p className="text-xs text-gray-500 mt-0.5">{breakdownLine1(e)}</p>
                {/* Line 2: priority tasks + adjustment */}
                <p className="text-xs text-gray-500">{breakdownLine2(e)}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setAdjustFor(e)}
                  className="text-gray-300 hover:text-blue-600 transition-colors shrink-0 mt-0.5"
                  title="Adjust points (admin only)"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Admin: adjust points modal */}
      <Modal open={!!adjustFor} onClose={() => setAdjustFor(null)} title={`Adjust points — ${adjustFor?.full_name || adjustFor?.email || ''}`} size="sm">
        <form onSubmit={submitAdjustment} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Points (use negative to deduct) *</label>
            <input
              type="number"
              value={adjustPoints}
              onChange={e => setAdjustPoints(e.target.value)}
              placeholder="e.g. -1 or 2"
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Reason</label>
            <input
              type="text"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="e.g. Supplier added twice in error"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={adjustLoading}>Apply adjustment</Button>
            <Button type="button" variant="secondary" onClick={() => setAdjustFor(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
