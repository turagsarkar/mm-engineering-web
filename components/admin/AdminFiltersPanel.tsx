'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { Button } from '@/components/ui/Button'
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react'

interface ProfileOption { id: string; full_name: string | null; email: string }

interface BrandResult {
  id: string; name: string; slug: string
  confirmed_suppliers: boolean; ai_do_not_quote: boolean
  created_at: string
  supplierCount: number; aiApprovedCount: number
}

interface SupplierResult {
  id: string; name: string; traffic_light: string | null
  brandName: string; brandSlug: string; added_by: string | null
}

type SortKey = 'name' | 'count' | 'created'

// 2.12 Admin Filters Panel — all 9 filters combinable.
// Brand filters return brands; if any supplier filter is on, results switch to suppliers.
export function AdminFiltersPanel({ profiles }: { profiles: ProfileOption[] }) {
  const router = useRouter()
  // Brand filters
  const [confirmedOn, setConfirmedOn] = useState(false)
  const [confirmedOff, setConfirmedOff] = useState(false)
  const [aiDnq, setAiDnq] = useState(false)
  const [noAiApproved, setNoAiApproved] = useState(false)
  const [zeroSuppliers, setZeroSuppliers] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // Supplier filters
  const [addedBy, setAddedBy] = useState('')
  const [trafficRed, setTrafficRed] = useState(false)
  const [overdueReview, setOverdueReview] = useState(false)

  const [brandResults, setBrandResults] = useState<BrandResult[] | null>(null)
  const [supplierResults, setSupplierResults] = useState<SupplierResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const supplierMode = !!addedBy || trafficRed || overdueReview

  async function run() {
    setLoading(true)
    const supabase = createClient()

    if (supplierMode) {
      const data = await fetchAllRows((from, to) => {
        let q = supabase
          .from('suppliers')
          .select('id, name, traffic_light, added_by, brands!inner(name, slug, last_reviewed_at, review_interval_months, review_disabled)')
          .eq('supplier_status', 'active')
          .order('name')
          .range(from, to)
        if (addedBy) q = q.eq('added_by', addedBy)
        if (trafficRed) q = q.eq('traffic_light', 'red')
        return q
      })

      let rows = (data as unknown as {
        id: string; name: string; traffic_light: string | null; added_by: string | null
        brands: { name: string; slug: string; last_reviewed_at: string | null; review_interval_months: number; review_disabled: boolean }
      }[])

      if (overdueReview) {
        rows = rows.filter(s => {
          const b = s.brands
          if (b.review_disabled) return false
          if (!b.last_reviewed_at) return true
          const next = new Date(b.last_reviewed_at)
          next.setMonth(next.getMonth() + (b.review_interval_months || 6))
          return next.getTime() <= Date.now()
        })
      }

      setSupplierResults(rows.map(s => ({
        id: s.id, name: s.name, traffic_light: s.traffic_light,
        brandName: s.brands.name, brandSlug: s.brands.slug, added_by: s.added_by,
      })))
      setBrandResults(null)
    } else {
      const data = await fetchAllRows((from, to) => {
        let q = supabase
          .from('brands')
          .select('id, name, slug, confirmed_suppliers, ai_do_not_quote, created_at, suppliers(id, ai_approved)')
          .order('name')
          .range(from, to)
        if (confirmedOn && !confirmedOff) q = q.eq('confirmed_suppliers', true)
        if (confirmedOff && !confirmedOn) q = q.eq('confirmed_suppliers', false)
        if (aiDnq) q = q.eq('ai_do_not_quote', true)
        if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
        if (dateTo) q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString())
        return q
      })

      let rows = (data as unknown as {
        id: string; name: string; slug: string; confirmed_suppliers: boolean
        ai_do_not_quote: boolean; created_at: string
        suppliers: { id: string; ai_approved: boolean }[]
      }[]).map(b => ({
        id: b.id, name: b.name, slug: b.slug,
        confirmed_suppliers: b.confirmed_suppliers, ai_do_not_quote: b.ai_do_not_quote,
        created_at: b.created_at,
        supplierCount: b.suppliers.length,
        aiApprovedCount: b.suppliers.filter(s => s.ai_approved).length,
      }))

      if (noAiApproved) rows = rows.filter(b => b.aiApprovedCount === 0)
      if (zeroSuppliers) rows = rows.filter(b => b.supplierCount === 0)

      setBrandResults(rows)
      setSupplierResults(null)
    }
    setLoading(false)
  }

  function sortBrands(rows: BrandResult[]) {
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === 'count') return a.supplierCount - b.supplierCount
      if (sortKey === 'created') return a.created_at.localeCompare(b.created_at)
      return a.name.localeCompare(b.name)
    })
    return sortAsc ? sorted : sorted.reverse()
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(true) }
  }

  const checkbox = (checked: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      {label}
    </label>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">Admin Filters</h2>
        <span className="text-xs text-gray-400">— combine any filters, then run</span>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand filters</p>
          {checkbox(confirmedOn, setConfirmedOn, 'Confirmed suppliers = ON')}
          {checkbox(confirmedOff, setConfirmedOff, 'Confirmed suppliers = OFF (needs attention)')}
          {checkbox(aiDnq, setAiDnq, 'AI Do Not Quote = ON')}
          {checkbox(noAiApproved, setNoAiApproved, 'No AI-approved suppliers')}
          {checkbox(zeroSuppliers, setZeroSuppliers, 'Brands with zero suppliers')}
          <div className="flex gap-2 pt-1">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Added from</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Added to</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier filters</p>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">Added by user</label>
            <select value={addedBy} onChange={e => setAddedBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
              <option value="">Any user</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>
          {checkbox(trafficRed, setTrafficRed, 'Traffic light = Red (Do Not Use)')}
          {checkbox(overdueReview, setOverdueReview, 'Brand overdue for review')}
          <p className="text-xs text-gray-400 pt-1">
            Selecting a supplier filter switches results to supplier rows.
          </p>
        </div>
      </div>

      <div className="px-6 pb-5">
        <Button onClick={run} loading={loading}>Run filters</Button>
      </div>

      {/* Brand results */}
      {brandResults && (
        <div className="border-t border-gray-100">
          <div className="px-6 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{brandResults.length} brand{brandResults.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-1">
              {([['name', 'Name'], ['count', 'Suppliers'], ['created', 'Date']] as [SortKey, string][]).map(([k, label]) => (
                <button key={k} onClick={() => toggleSort(k)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                    sortKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {label} <ArrowUpDown className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
            {sortBrands(brandResults).slice(0, 300).map(b => (
              <button key={b.id} onClick={() => router.push(`/brands/${b.slug}`)}
                className="flex items-center gap-3 w-full px-6 py-2.5 hover:bg-gray-50 transition-colors text-left text-sm">
                <span className="flex-1 font-medium text-gray-900 truncate">{b.name}</span>
                {b.ai_do_not_quote && <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">AI DNQ</span>}
                {b.confirmed_suppliers
                  ? <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">Sourcing Complete</span>
                  : <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">Sourcing Required</span>}
                <span className="text-xs text-gray-400 w-20 text-right">{b.supplierCount} supplier{b.supplierCount !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Supplier results */}
      {supplierResults && (
        <div className="border-t border-gray-100">
          <div className="px-6 py-3">
            <p className="text-sm font-medium text-gray-900">{supplierResults.length} supplier{supplierResults.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
            {supplierResults.slice(0, 300).map(s => (
              <button key={s.id} onClick={() => router.push(`/suppliers/${s.id}`)}
                className="flex items-center gap-3 w-full px-6 py-2.5 hover:bg-gray-50 transition-colors text-left text-sm">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  s.traffic_light === 'amber' ? 'bg-amber-400' : s.traffic_light === 'red' ? 'bg-red-500' : 'bg-green-500'
                }`} />
                <span className="font-medium text-gray-900 truncate">{s.name}</span>
                <span className="text-xs text-gray-400 ml-auto truncate">{s.brandName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
