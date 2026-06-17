'use client'
import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, Truck, BarChart2, ChevronDown, ChevronRight } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { timeAgo } from '@/lib/utils/format'

interface PendingSupplier {
  id: string
  name: string
  email: string | null
  contact_name: string | null
  margin: string | null
  where_to_look: string | null
  po_number: string | null
  traffic_light: string | null
  notes: string | null
  created_at: string
  brands: { name: string; slug: string } | null
  profiles: { full_name: string | null; email: string } | null
}

interface ComparisonLine {
  id: string
  supplier_name: string | null
  price: number | null
  lead_time: string | null
  response_time: string | null
  notes: string | null
}

interface PendingComparison {
  id: string
  part_number: string
  created_at: string
  brands: { name: string; slug: string } | null
  profiles: { full_name: string | null; email: string } | null
  lines: ComparisonLine[]
}

const TL_LABEL: Record<string, string> = {
  green: 'Primary',
  amber: 'Alternative/Stock',
  red: 'Do Not Use',
}

export function PendingApprovalsPanel() {
  const { isAdmin } = useUser()
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<PendingSupplier[]>([])
  const [comparisons, setComparisons] = useState<PendingComparison[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

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
        ? 'Approved — 3 points awarded'
        : 'Rejected and removed', 'success')
      load()
    }
    setBusy(null)
  }

  function toggle(id: string) { setExpanded(prev => prev === id ? null : id) }

  if (!isAdmin || !loaded) return null
  const total = suppliers.length + comparisons.length
  if (total === 0) return null

  const detailRow = (label: string, value: string | null) =>
    value ? (
      <div className="flex gap-2">
        <dt className="text-gray-400 w-28 shrink-0">{label}</dt>
        <dd className="text-gray-800">{value}</dd>
      </div>
    ) : null

  return (
    <div className="bg-white rounded-xl border-2 border-purple-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border-b border-purple-100">
        <ShieldCheck className="h-4 w-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-purple-900">Pending Approvals</h3>
        <span className="ml-auto text-xs font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">{total}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {/* Pending suppliers */}
        {suppliers.map(s => {
          const isOpen = expanded === `s-${s.id}`
          return (
            <div key={s.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggle(`s-${s.id}`)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {s.name}
                    <span className="ml-2 text-xs font-normal text-gray-400">new supplier · 3pts</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {s.brands?.name} · by {s.profiles?.full_name || s.profiles?.email} · {timeAgo(s.created_at)}
                  </p>
                </div>
                <button onClick={() => decide('supplier', s.id, 'approve')} disabled={busy === s.id}
                  className="text-xs font-medium px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 shrink-0">
                  Approve
                </button>
                <button onClick={() => decide('supplier', s.id, 'reject')} disabled={busy === s.id}
                  className="text-xs font-medium px-2.5 py-1 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 shrink-0">
                  Reject
                </button>
              </div>
              {isOpen && (
                <div className="px-12 pb-3 bg-gray-50 border-t border-gray-100">
                  <dl className="text-xs space-y-1 pt-2">
                    {detailRow('Brand', s.brands?.name ?? null)}
                    {detailRow('Priority', TL_LABEL[s.traffic_light ?? 'green'])}
                    {detailRow('Email', s.email)}
                    {detailRow('Contact name', s.contact_name)}
                    {detailRow('Margin', s.margin)}
                    {detailRow('Where to look', s.where_to_look)}
                    {detailRow('Previous PO', s.po_number)}
                    {detailRow('Notes', s.notes)}
                  </dl>
                </div>
              )}
            </div>
          )
        })}

        {/* Pending comparisons */}
        {comparisons.map(c => {
          const isOpen = expanded === `c-${c.id}`
          return (
            <div key={c.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggle(`c-${c.id}`)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <BarChart2 className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate font-mono">
                    {c.part_number}
                    <span className="ml-2 text-xs font-normal font-sans text-gray-400">price comparison · 3pts</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {c.brands?.name} · by {c.profiles?.full_name || c.profiles?.email} · {timeAgo(c.created_at)} · {c.lines.length} price{c.lines.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => decide('comparison', c.id, 'approve')} disabled={busy === c.id}
                  className="text-xs font-medium px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 shrink-0">
                  Approve
                </button>
                <button onClick={() => decide('comparison', c.id, 'reject')} disabled={busy === c.id}
                  className="text-xs font-medium px-2.5 py-1 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 shrink-0">
                  Reject
                </button>
              </div>
              {isOpen && (
                <div className="px-12 pb-3 bg-gray-50 border-t border-gray-100">
                  {c.lines.length === 0 ? (
                    <p className="text-xs text-gray-400 pt-2">No price lines on this comparison.</p>
                  ) : (
                    <table className="w-full text-xs mt-2">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left py-1 font-medium">Supplier</th>
                          <th className="text-left py-1 font-medium">Price</th>
                          <th className="text-left py-1 font-medium">Lead time</th>
                          <th className="text-left py-1 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {c.lines.map(l => (
                          <tr key={l.id}>
                            <td className="py-1 font-medium text-gray-800">{l.supplier_name}</td>
                            <td className="py-1 text-gray-700">{l.price != null ? l.price : '—'}</td>
                            <td className="py-1 text-gray-500">{l.lead_time || '—'}</td>
                            <td className="py-1 text-gray-400 truncate max-w-[10rem]">{l.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
