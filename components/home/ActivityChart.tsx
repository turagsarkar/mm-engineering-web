'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { GroupedBarChart } from '@/components/charts/Charts'

// The three headline metrics (brief 2.10) shown on the home screen, defaulting
// to the current month.
const CORE_METRICS: { key: string; label: string; color: string }[] = [
  { key: 'brand_added', label: 'Brands added', color: '#3b82f6' },
  { key: 'supplier_added', label: 'Suppliers added', color: '#22c55e' },
  { key: 'price_comparison_added', label: 'Price comparisons', color: '#f59e0b' },
]

interface Row { action_type: string; created_at: string }

export function ActivityChart() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const since = new Date(); since.setMonth(since.getMonth() - 1)
    const supabase = createClient()
    fetchAllRows<Row>((lo, hi) =>
      supabase.from('activity_log')
        .select('action_type, created_at')
        .gte('created_at', since.toISOString())
        .in('action_type', CORE_METRICS.map(m => m.key))
        .order('created_at', { ascending: true })
        .range(lo, hi)
    ).then(data => { if (active) { setRows(data); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const totals = CORE_METRICS.map(m => ({ ...m, total: rows.filter(r => r.action_type === m.key).length }))

  // Bucket per day for the month
  const buckets = new Map<string, number[]>()
  for (const r of rows) {
    const idx = CORE_METRICS.findIndex(m => m.key === r.action_type)
    if (idx === -1) continue
    const k = new Date(r.created_at).toISOString().split('T')[0]
    const arr = buckets.get(k) || [0, 0, 0]
    arr[idx]++
    buckets.set(k, arr)
  }
  const series = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, values]) => ({ label, values }))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><BarChart3 className="h-4 w-4" /></span>
          Activity this month
        </h3>
        <Link href="/admin/reports" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          Full reports <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {totals.map(m => (
          <div key={m.key} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
              <p className="text-2xl font-bold text-gray-900">{loading ? '—' : m.total}</p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Daily grouped bars */}
      {loading ? (
        <div className="h-36 flex items-center justify-center text-sm text-gray-400">Loading…</div>
      ) : series.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-sm text-gray-400">No activity this month yet</div>
      ) : (
        <GroupedBarChart height={150}
          buckets={series.map(s => ({ label: s.label.slice(8), values: s.values }))}
          series={CORE_METRICS.map(m => ({ label: m.label, color: m.color }))} />
      )}
    </div>
  )
}
