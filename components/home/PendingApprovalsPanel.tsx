'use client'
import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, Truck, BarChart2 } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { timeAgo } from '@/lib/utils/format'

interface PendingSupplier {
  id: string
  name: string
  email: string | null
  traffic_light: string | null
  created_at: string
  brands: { name: string; slug: string } | null
  profiles: { full_name: string | null; email: string } | null
}

interface PendingComparison {
  id: string
  part_number: string
  created_at: string
  brands: { name: string; slug: string } | null
  profiles: { full_name: string | null; email: string } | null
}

// Admin-only queue: entries submitted under priority brands wait here.
// Approving puts them live and awards the submitter's points.
export function PendingApprovalsPanel() {
  const { isAdmin } = useUser()
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<PendingSupplier[]>([])
  const [comparisons, setComparisons] = useState<PendingComparison[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/approvals')
    if (!res.ok) return
    const json = await res.json()
    setSuppliers(json.suppliers || [])
    setComparisons(json.comparisons || [])
    setLoaded(true)
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  async function decide(type: 'supplier' | 'comparison', id: string, action: 'approve' | 'reject') {
    setBusy(id)
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, action }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast(json.error || 'Failed', 'error')
    } else {
      toast(action === 'approve'
        ? `Approved — ${type === 'supplier' ? '1 point' : '2 points'} awarded`
        : 'Rejected and removed', 'success')
      load()
    }
    setBusy(null)
  }

  if (!isAdmin || !loaded) return null
  const total = suppliers.length + comparisons.length
  if (total === 0) return null

  return (
    <div className="bg-white rounded-xl border-2 border-purple-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border-b border-purple-100">
        <ShieldCheck className="h-4 w-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-purple-900">Pending Approvals</h3>
        <span className="ml-auto text-xs font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">
          {total}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {suppliers.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <Truck className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {s.name}
                <span className="ml-2 text-xs font-normal text-gray-400">new supplier · 1pt</span>
              </p>
              <p className="text-xs text-gray-500 truncate">
                {s.brands?.name} · by {s.profiles?.full_name || s.profiles?.email} · {timeAgo(s.created_at)}
              </p>
            </div>
            <button
              onClick={() => decide('supplier', s.id, 'approve')}
              disabled={busy === s.id}
              className="text-xs font-medium px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
            >
              Approve
            </button>
            <button
              onClick={() => decide('supplier', s.id, 'reject')}
              disabled={busy === s.id}
              className="text-xs font-medium px-2.5 py-1 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
            >
              Reject
            </button>
          </div>
        ))}
        {comparisons.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <BarChart2 className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate font-mono">
                {c.part_number}
                <span className="ml-2 text-xs font-normal font-sans text-gray-400">price comparison · 2pts</span>
              </p>
              <p className="text-xs text-gray-500 truncate">
                {c.brands?.name} · by {c.profiles?.full_name || c.profiles?.email} · {timeAgo(c.created_at)}
              </p>
            </div>
            <button
              onClick={() => decide('comparison', c.id, 'approve')}
              disabled={busy === c.id}
              className="text-xs font-medium px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
            >
              Approve
            </button>
            <button
              onClick={() => decide('comparison', c.id, 'reject')}
              disabled={busy === c.id}
              className="text-xs font-medium px-2.5 py-1 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
            >
              Reject
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
