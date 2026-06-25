'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Bot, AlertTriangle, Mail, ClipboardCheck, Tag, Truck, Download, TrendingUp, CheckCircle2, BarChart3, LineChart as LineIcon, ChevronDown, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'
import { BarChart, HBarChart, AreaLineChart, DonutChart } from '@/components/charts/Charts'
import type { EnquiryRow, ReviewRow, CoverageSupplier } from './page'

type Period = '1w' | '1m' | '3m' | 'all' | 'custom'
type Tab = 'brands' | 'suppliers' | 'enquiries' | 'reviews' | 'manual_brands'

const PERIOD_LABEL: Record<Period, string> = {
  '1w': '1 week', '1m': '1 month', '3m': '3 months', all: 'All time', custom: 'Custom',
}

// The 11 manual-review / skip reason codes from brief §3 (schema enum
// ai_reason_code). These always appear in the Reason-code dropdown and the
// "Enquiries by Reason Code" chart, even when a code has zero rows.
const REVIEW_REASON_CODES = [
  'motor_enquiry',
  'brand_not_found',
  'ai_do_not_quote',
  'multiple_brands_single_line',
  'no_ai_approved_supplier',
  'no_supplier_email',
  'no_part_number_extracted',
  'no_brand_extracted',
  'low_confidence',
  'repeat_enquiry',
  'duplicate_resubmission',
] as const
// Other codes that can appear in enquiry_log / the review queue.
const OTHER_REASON_CODES = [
  'supplier_sent',
  'attachments_present',
  'confirmed_suppliers_warning',
  'no_rfqs_sent_footer',
  'not_processed_by_ai',
  'filtered',
] as const
const ALL_REASON_CODES: string[] = [...REVIEW_REASON_CODES, ...OTHER_REASON_CODES]

// Friendly labels. Unknown codes are humanised automatically.
const REASON_LABELS: Record<string, string> = {
  motor_enquiry: 'Pure motor enquiry',
  brand_not_found: 'Brand not found',
  ai_do_not_quote: 'Brand: AI do not quote',
  multiple_brands_single_line: 'Multiple brands on one line',
  no_ai_approved_supplier: 'No AI-approved supplier',
  no_supplier_email: 'No supplier email',
  no_part_number_extracted: 'No part number extracted',
  no_brand_extracted: 'No brand extracted',
  low_confidence: 'Low confidence',
  repeat_enquiry: 'Repeat enquiry (3-month match)',
  duplicate_resubmission: 'Duplicate re-submission',
  supplier_sent: 'Supplier RFQ sent',
  attachments_present: 'Attachments present',
  confirmed_suppliers_warning: 'Confirmed-suppliers warning',
  no_rfqs_sent_footer: 'No RFQs sent',
  not_processed_by_ai: 'Not processed by AI',
  filtered: 'Filtered (spam / OOO / reply)',
}
function reasonLabel(code: string): string {
  return REASON_LABELS[code] || code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function periodStart(p: Period, customFrom: string): number | null {
  const now = Date.now()
  if (p === 'all') return null
  if (p === '1w') return now - 7 * 864e5
  if (p === '1m') { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.getTime() }
  if (p === '3m') { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.getTime() }
  if (p === 'custom' && customFrom) return new Date(customFrom).getTime()
  return null
}

interface Props {
  aiApproved: number
  dnqBrands: number
  totalBrands: number
  confirmedBrands: number
  enquiries: EnquiryRow[]
  reviews: ReviewRow[]
  coverageSuppliers: CoverageSupplier[]
}

export function AiDashboardClient({ aiApproved, dnqBrands, totalBrands, confirmedBrands, enquiries, reviews, coverageSuppliers }: Props) {
  const { toast } = useToast()
  const [period, setPeriod] = useState<Period>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [reasonFilter, setReasonFilter] = useState<Set<string>>(new Set())
  const [brandFilter, setBrandFilter] = useState('')
  const [tab, setTab] = useState<Tab>('manual_brands')
  const [trendMode, setTrendMode] = useState<'bar' | 'line'>('bar')
  const [reasonOpen, setReasonOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const start = periodStart(period, customFrom)
  const end = period === 'custom' && customTo ? new Date(customTo + 'T23:59:59').getTime() : null

  function inPeriod(ts: string | null): boolean {
    if (!ts) return start === null
    const t = new Date(ts).getTime()
    if (start !== null && t < start) return false
    if (end !== null && t > end) return false
    return true
  }

  // ---- Filter options ----
  // Always offer the full canonical reason-code set (brief §3) plus any extra
  // codes that turn up in the live data, so the dropdown lists them all.
  const allReasonCodes = useMemo(() => {
    const s = new Set<string>(ALL_REASON_CODES)
    for (const e of enquiries) if (e.reason_code) s.add(e.reason_code)
    for (const r of reviews) if (r.reason_code) s.add(r.reason_code)
    // preserve canonical order, then any extras alphabetically
    const extras = [...s].filter(c => !ALL_REASON_CODES.includes(c)).sort()
    return [...ALL_REASON_CODES.filter(c => s.has(c)), ...extras]
  }, [enquiries, reviews])

  // Row counts per reason code (across all data) for the dropdown.
  const reasonCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of enquiries) if (e.reason_code) m.set(e.reason_code, (m.get(e.reason_code) ?? 0) + 1)
    for (const r of reviews) if (r.reason_code) m.set(r.reason_code, (m.get(r.reason_code) ?? 0) + 1)
    return m
  }, [enquiries, reviews])

  const allBrands = useMemo(() => {
    const s = new Set<string>()
    for (const e of enquiries) if (e.brand_detected) s.add(e.brand_detected)
    for (const r of reviews) if (r.brand_extracted) s.add(r.brand_extracted)
    return [...s].sort()
  }, [enquiries, reviews])

  // ---- Apply all filters (date + reason + brand) ----
  const matchReason = (code: string | null) => reasonFilter.size === 0 || (code != null && reasonFilter.has(code))

  const enqF = useMemo(() => enquiries.filter(e =>
    inPeriod(e.processed_at) && matchReason(e.reason_code) && (!brandFilter || e.brand_detected === brandFilter)
  ), [enquiries, period, customFrom, customTo, reasonFilter, brandFilter])

  const revF = useMemo(() => reviews.filter(r =>
    inPeriod(r.created_at) && matchReason(r.reason_code) && (!brandFilter || r.brand_extracted === brandFilter)
  ), [reviews, period, customFrom, customTo, reasonFilter, brandFilter])

  const pendingReviews = useMemo(() => revF.filter(r => (r.status ?? 'pending') === 'pending'), [revF])

  // ---- Per-reference auto-processing outcome (2.11 metrics) ----
  // Fully = all lines RFQ-sent, no manual review. Partial = some sent + some
  // review. Manual only = review rows but nothing sent.
  interface RefAgg { sent: number; review: number; date: number }
  const refMap = useMemo(() => {
    const m = new Map<string, RefAgg>()
    const touch = (ref: string, ts: string | null) => {
      const t = ts ? new Date(ts).getTime() : 0
      let cur = m.get(ref)
      if (!cur) { cur = { sent: 0, review: 0, date: t }; m.set(ref, cur) }
      else if (t && (cur.date === 0 || t < cur.date)) cur.date = t
      return cur
    }
    for (const e of enqF) { const a = touch(e.reference || e.id, e.processed_at); if ((e.status ?? 'sent') === 'sent') a.sent++ }
    for (const r of revF) { const a = touch(r.reference || r.id, r.created_at); a.review++ }
    return m
  }, [enqF, revF])

  const metrics = useMemo(() => {
    let fully = 0, partial = 0, manual = 0
    for (const r of refMap.values()) {
      if (r.sent > 0 && r.review === 0) fully++
      else if (r.sent > 0 && r.review > 0) partial++
      else if (r.review > 0) manual++
    }
    const total = refMap.size
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
    return { total, fully, partial, manual, fullyPct: pct(fully), partialPct: pct(partial), manualPct: pct(manual) }
  }, [refMap])

  // ---- Success rate over time ----
  const trend = useMemo(() => {
    const startTs = start ?? Math.min(...[...refMap.values()].map(r => r.date).filter(Boolean), Date.now())
    const endTs = end ?? Date.now()
    const spanDays = (endTs - startTs) / 864e5
    const byMonth = spanDays > 45 || !isFinite(spanDays)
    const fmt = (t: number) => {
      const d = new Date(t)
      return byMonth ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : d.toISOString().split('T')[0]
    }
    const buckets = new Map<string, { fully: number; total: number }>()
    for (const r of refMap.values()) {
      if (!r.date) continue
      const k = fmt(r.date)
      const b = buckets.get(k) || { fully: 0, total: 0 }
      b.total++
      if (r.sent > 0 && r.review === 0) b.fully++
      buckets.set(k, b)
    }
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, v]) => ({ label, value: v.total > 0 ? Math.round((v.fully / v.total) * 100) : 0, total: v.total }))
  }, [refMap, start, end])

  // ---- Enquiries by reason code (all canonical codes included, brief §3) ----
  const reasonChart = useMemo(() => {
    const m = new Map<string, number>()
    // seed all 11 review codes so they always appear (even at zero)
    for (const c of REVIEW_REASON_CODES) m.set(c, 0)
    for (const e of enqF) { const c = e.reason_code || 'unknown'; m.set(c, (m.get(c) ?? 0) + 1) }
    for (const r of revF) { const c = r.reason_code || 'unknown'; m.set(c, (m.get(c) ?? 0) + 1) }
    return [...m.entries()]
      .map(([code, count]) => ({ label: reasonLabel(code), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [enqF, revF])

  // ---- Supplier coverage growth (cumulative brands with >=1 ai_approved supplier) ----
  const coverage = useMemo(() => {
    const sorted = [...coverageSuppliers].filter(s => s.created_at).sort((a, b) => a.created_at!.localeCompare(b.created_at!))
    const seen = new Set<string>()
    const monthly = new Map<string, number>()
    for (const s of sorted) {
      if (s.brand_id) seen.add(s.brand_id)
      const d = new Date(s.created_at!)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthly.set(k, seen.size)
    }
    return [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }))
  }, [coverageSuppliers])

  // ---- Top brands by manual review ----
  // Grouped by the brand the workflow extracted. Rows whose brand wasn't logged
  // (workflow gap) are grouped under "Brand not logged" so the count is still
  // accurate and the cause is visible.
  const topManualBrands = useMemo(() => {
    const m = new Map<string, { count: number; reasons: Map<string, number> }>()
    for (const r of revF) {
      const b = (r.brand_extracted || '').trim() || 'Brand not logged'
      const e = m.get(b) || { count: 0, reasons: new Map() }
      e.count++
      const rc = r.reason_code || 'unknown'
      e.reasons.set(rc, (e.reasons.get(rc) ?? 0) + 1)
      m.set(b, e)
    }
    return [...m.entries()].map(([name, v]) => {
      const top = [...v.reasons.entries()].sort((a, b) => b[1] - a[1])[0]
      return { name, count: v.count, reason: top ? reasonLabel(top[0]) : '—', unlogged: name === 'Brand not logged' }
    }).sort((a, b) => b.count - a.count)
  }, [revF])
  const unloggedReviews = useMemo(() => revF.filter(r => !(r.brand_extracted || '').trim()).length, [revF])

  // ---- Rankings for AI-used drilldowns ----
  function rank(items: string[]) {
    const m = new Map<string, number>()
    for (const x of items) { const k = (x || 'Unknown').trim(); m.set(k, (m.get(k) ?? 0) + 1) }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }
  const topBrands = useMemo(() => rank(enqF.map(e => e.brand_detected || 'Unknown')), [enqF])
  const topSuppliers = useMemo(() => rank(enqF.map(e => e.supplier_name || 'Unknown')), [enqF])

  // ---- KPI cards (2.11) ----
  const kpis = [
    { label: 'Enquiries Processed', value: metrics.total, sub: 'genuine enquiries', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Mail },
    { label: 'Fully Auto-Processed', value: `${metrics.fullyPct}%`, sub: `${metrics.fully} enquiries`, color: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle2 },
    { label: 'Partially Auto-Processed', value: `${metrics.partialPct}%`, sub: `${metrics.partial} enquiries`, color: 'bg-amber-50 text-amber-600 border-amber-100', icon: AlertTriangle },
    { label: 'Manual Review Only', value: `${metrics.manualPct}%`, sub: `${metrics.manual} enquiries`, color: 'bg-red-50 text-red-600 border-red-100', icon: ClipboardCheck },
  ]

  // Secondary clickable cards (kept from earlier requirements 51-54)
  const cards = [
    { id: 'ai_approved', label: 'AI-Approved Suppliers', value: aiApproved, icon: Bot, color: 'bg-green-50 text-green-600 border-green-100', href: '/admin/ai-eligible', tab: null },
    { id: 'dnq', label: 'AI Do Not Quote Brands', value: dnqBrands, icon: AlertTriangle, color: 'bg-red-50 text-red-600 border-red-100', href: '/brands?filter=ai_do_not_quote', tab: null },
    { id: 'enquiries', label: 'AI Enquiries Sent', value: enqF.length, icon: Mail, color: 'bg-blue-50 text-blue-600 border-blue-100', href: null, tab: 'enquiries' as Tab },
    { id: 'reviews', label: 'Pending Manual Review', value: pendingReviews.length, icon: ClipboardCheck, color: 'bg-orange-50 text-orange-600 border-orange-100', href: null, tab: 'reviews' as Tab },
  ]

  const tabs: { id: Tab; label: string; icon: typeof Tag; count: number }[] = [
    { id: 'manual_brands', label: 'Top Brands by Manual Review', icon: AlertTriangle, count: topManualBrands.length },
    { id: 'brands', label: 'Top Brands AI Used', icon: Tag, count: topBrands.length },
    { id: 'suppliers', label: 'Top Suppliers AI Used', icon: Truck, count: topSuppliers.length },
    { id: 'enquiries', label: 'Enquiries Sent', icon: Mail, count: enqF.length },
    { id: 'reviews', label: 'Pending Review', icon: ClipboardCheck, count: pendingReviews.length },
  ]

  // ---- CSV exports ----
  function downloadCsv(name: string, header: string, rows: string[]) {
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${name}-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  async function exportBrands() {
    setExporting('brands')
    const supabase = createClient()
    const rows = await fetchAllRows<{ name: string; aliases: string[] | null; ai_do_not_quote: boolean; confirmed_suppliers: boolean; last_reviewed_at: string | null; next_review_at: string | null }>(
      (f, t) => supabase.from('brands').select('name, aliases, ai_do_not_quote, confirmed_suppliers, last_reviewed_at, next_review_at').order('name').range(f, t)
    )
    downloadCsv('brands', 'Brand,Aliases,AI Do Not Quote,Sourcing Status,Last Reviewed,Next Review',
      rows.map(b => [esc(b.name), esc((b.aliases || []).join(' | ')), b.ai_do_not_quote ? 'Yes' : 'No', b.confirmed_suppliers ? 'Sourcing Complete' : 'Sourcing Required', esc(b.last_reviewed_at || ''), esc(b.next_review_at || '')].join(',')))
    setExporting(null); toast(`Exported ${rows.length} brands`, 'success')
  }

  async function exportSuppliers() {
    setExporting('suppliers')
    const supabase = createClient()
    const tl: Record<string, string> = { green: 'Primary', amber: 'Alternative/Stock', red: 'Do Not Use' }
    const rows = await fetchAllRows<{ name: string; email: string | null; contact_name: string | null; margin: string | null; traffic_light: string | null; ai_approved: boolean; supplier_status: string; brands: { name: string } | null }>(
      (f, t) => supabase.from('suppliers').select('name, email, contact_name, margin, traffic_light, ai_approved, supplier_status, brands(name)').neq('supplier_status', 'pending').order('name').range(f, t)
    )
    downloadCsv('suppliers', 'Supplier,Brand,Email,Contact,Margin,Traffic Light,AI Approved,Status',
      rows.map(s => [esc(s.name), esc(s.brands?.name || ''), esc(s.email || ''), esc(s.contact_name || ''), esc(s.margin || ''), esc(tl[s.traffic_light ?? 'green'] || ''), s.ai_approved ? 'Yes' : 'No', esc(s.supplier_status)].join(',')))
    setExporting(null); toast(`Exported ${rows.length} suppliers`, 'success')
  }

  function exportEnquiries() {
    downloadCsv('ai-enquiries', 'Reference,Brand,Supplier,Status,Reason,Confidence,Sent',
      enqF.map(e => [esc(e.reference || ''), esc(e.brand_detected || ''), esc(e.supplier_name || ''), esc(e.status || ''), esc(e.reason_code || ''), esc(e.confidence || ''), esc(e.processed_at || '')].join(',')))
  }

  const filtersActive = reasonFilter.size > 0 || !!brandFilter || period !== 'all'

  return (
    <div className="space-y-6">
      {/* ---- Filters: date range + reason code (multi) + brand (single) ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Time period:</span>
          {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${period === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
          {period === 'custom' && (
            <span className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </span>
          )}
        </div>

        <div className="flex items-start gap-6 flex-wrap">
          {/* Reason code multi-select dropdown — lists ALL reason codes */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500">Reason code (multi-select):</span>
            <div className="relative">
              <button type="button" onClick={() => setReasonOpen(o => !o)}
                className="flex items-center justify-between gap-2 text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 min-w-[14rem]">
                <span className={reasonFilter.size ? 'text-gray-900' : 'text-gray-500'}>
                  {reasonFilter.size === 0 ? 'All reason codes' : `${reasonFilter.size} selected`}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${reasonOpen ? 'rotate-180' : ''}`} />
              </button>
              {reasonOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setReasonOpen(false)} />
                  <div className="absolute z-20 mt-1 w-72 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <button onClick={() => setReasonFilter(new Set(allReasonCodes))} className="text-[11px] text-blue-600 hover:underline">Select all</button>
                      <button onClick={() => setReasonFilter(new Set())} className="text-[11px] text-gray-400 hover:text-gray-600">Clear</button>
                    </div>
                    {allReasonCodes.map(c => {
                      const on = reasonFilter.has(c)
                      const n = reasonCounts.get(c) ?? 0
                      return (
                        <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-xs">
                          <input type="checkbox" checked={on} onChange={() => setReasonFilter(prev => { const x = new Set(prev); if (x.has(c)) x.delete(c); else x.add(c); return x })}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="flex-1 text-gray-700">{reasonLabel(c)}</span>
                          <span className={`tabular-nums ${n > 0 ? 'text-gray-500' : 'text-gray-300'}`}>{n}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Brand single-select */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500">Brand (single-select):</span>
            <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[12rem]">
              <option value="">All brands</option>
              {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Selected reason-code chips */}
        {reasonFilter.size > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[...reasonFilter].map(c => (
              <span key={c} className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-2 py-0.5">
                {reasonLabel(c)}
                <button onClick={() => setReasonFilter(prev => { const x = new Set(prev); x.delete(c); return x })} className="hover:text-blue-900">×</button>
              </span>
            ))}
          </div>
        )}
        {filtersActive && (
          <p className="text-xs text-gray-400">All panels below respond to the active filters.</p>
        )}
      </div>

      {/* ---- KPI cards (2.11) ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{k.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                </div>
                <div className={`p-2 rounded-lg border ${k.color}`}><Icon className="h-5 w-5" /></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- Charts grid ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success rate over time */}
        <Panel title="Success Rate Over Time" icon={TrendingUp}
          action={
            <div className="flex items-center gap-1">
              <button onClick={() => setTrendMode('bar')} className={`p-1 rounded ${trendMode === 'bar' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><BarChart3 className="h-3.5 w-3.5" /></button>
              <button onClick={() => setTrendMode('line')} className={`p-1 rounded ${trendMode === 'line' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><LineIcon className="h-3.5 w-3.5" /></button>
            </div>
          }>
          {trend.length === 0 ? <Empty text="No enquiries in this period" /> :
            trendMode === 'bar'
              ? <BarChart data={trend.map(t => ({ label: t.label.slice(5), value: t.value }))} suffix="%" maxValue={100} />
              : <AreaLineChart data={trend.map(t => t.value)} labels={trend.map(t => t.label.slice(5))} suffix="%" maxValue={100} />}
        </Panel>

        {/* Enquiries by reason code */}
        <Panel title="Enquiries by Reason Code" icon={BarChart3}>
          {reasonChart.length === 0 ? <Empty text="No data in this period" /> :
            <HBarChart data={reasonChart} />}
        </Panel>

        {/* Supplier coverage growth */}
        <Panel title="Supplier Coverage Growth" icon={LineIcon} subtitle="Brands with ≥1 AI-approved supplier (cumulative)">
          {coverage.length === 0 ? <Empty text="No AI-approved suppliers yet" /> :
            <AreaLineChart data={coverage.map(c => c.value)} labels={coverage.map(c => c.label)} />}
        </Panel>

        {/* Confirmed suppliers progress */}
        <Panel title="Confirmed Suppliers Progress" icon={CheckCircle2} subtitle="Sourcing Complete vs Sourcing Required (all brands)">
          <DonutChart
            segments={[
              { label: 'Sourcing Complete', value: confirmedBrands, color: '#22c55e' },
              { label: 'Sourcing Required', value: Math.max(0, totalBrands - confirmedBrands), color: '#f87171' },
            ]}
            centerValue={`${totalBrands > 0 ? Math.round((confirmedBrands / totalBrands) * 100) : 0}%`}
            centerLabel="complete"
          />
        </Panel>
      </div>

      {/* ---- Secondary clickable cards (51-54) ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon
          const inner = (
            <div className={`bg-white rounded-xl border p-5 transition-shadow ${c.href || c.tab ? 'hover:shadow-sm cursor-pointer' : ''} ${c.tab && tab === c.tab ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{c.value.toLocaleString()}</p>
                </div>
                <div className={`p-2 rounded-lg border ${c.color}`}><Icon className="h-5 w-5" /></div>
              </div>
            </div>
          )
          if (c.href) return <Link key={c.id} href={c.href}>{inner}</Link>
          if (c.tab) return <button key={c.id} onClick={() => setTab(c.tab!)} className="text-left">{inner}</button>
          return <div key={c.id}>{inner}</div>
        })}
      </div>

      {/* ---- Exports ---- */}
      <div className="flex flex-wrap gap-2">
        <button onClick={exportBrands} disabled={exporting === 'brands'} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> {exporting === 'brands' ? 'Exporting…' : 'Export Brands + Aliases'}
        </button>
        <button onClick={exportSuppliers} disabled={exporting === 'suppliers'} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> {exporting === 'suppliers' ? 'Exporting…' : 'Export Suppliers (traffic light + AI)'}
        </button>
        <button onClick={exportEnquiries} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          <Download className="h-3.5 w-3.5" /> Export AI Enquiries
        </button>
      </div>

      {/* ---- Selectable tabs ---- */}
      <div className="flex items-center gap-0 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* ---- Tab content ---- */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tab === 'manual_brands' && (
          <div>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-900">Top brands by manual review ({topManualBrands.length})</h3>
            </div>
            {unloggedReviews > 0 && (
              <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{unloggedReviews} review item{unloggedReviews !== 1 ? 's' : ''} arrived without a brand from the workflow (shown as “Brand not logged”). Populate <code className="font-mono">manual_review_queue.brand_extracted</code> in n8n to break these out by brand.</span>
              </div>
            )}
            <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
              {topManualBrands.length === 0 ? <Empty text="No manual reviews in this period" /> :
                topManualBrands.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="text-xs font-semibold text-gray-400 w-8 shrink-0">#{i + 1}</span>
                    <span className={`font-medium flex-1 truncate ${r.unlogged ? 'text-gray-400 italic' : 'text-gray-900'}`}>{r.name}</span>
                    <span className="text-xs text-gray-400 truncate hidden sm:block">{r.reason}</span>
                    <span className="font-semibold text-red-600 shrink-0 w-20 text-right">{r.count} review{r.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        {tab === 'brands' && <RankedList title="Top brands the AI used (ranked)" rows={topBrands} unit="enquiries" empty="No AI enquiries in this period" />}
        {tab === 'suppliers' && <RankedList title="Top suppliers the AI used (ranked)" rows={topSuppliers} unit="enquiries" empty="No AI enquiries in this period" />}
        {tab === 'enquiries' && (
          <div>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">AI enquiries sent ({enqF.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
              {enqF.length === 0 ? <Empty text="No enquiries sent in this period" /> :
                enqF.map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-gray-400 w-32 shrink-0 truncate">{e.reference}</span>
                    <span className="font-medium text-gray-900 truncate flex-1">{e.brand_detected} <span className="text-gray-400 font-normal">→ {e.supplier_name}</span></span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{e.processed_at ? formatDateTime(e.processed_at) : ''}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        {tab === 'reviews' && (
          <div>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-gray-900">Pending manual review ({pendingReviews.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
              {pendingReviews.length === 0 ? <Empty text="Nothing pending review in this period" /> :
                pendingReviews.map(r => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 shrink-0">{r.reason_code || 'review'}</span>
                    <span className="text-gray-900 truncate flex-1">{r.email_subject || r.brand_extracted || '(no subject)'}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{r.created_at ? formatDateTime(r.created_at) : ''}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Presentational helpers ----------

function Panel({ title, subtitle, icon: Icon, action, children }: { title: string; subtitle?: string; icon: typeof Tag; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-2.5">
        <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  )
}

function RankedList({ title, rows, unit, empty }: { title: string; rows: { name: string; count: number }[]; unit: string; empty: string }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
        {rows.length === 0 ? <Empty text={empty} /> :
          rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="text-xs font-semibold text-gray-400 w-8 shrink-0">#{i + 1}</span>
              <span className="font-medium text-gray-900 flex-1 truncate">{r.name}</span>
              <span className="font-semibold text-blue-600 shrink-0">{r.count} {unit}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-6 py-10 text-center text-sm text-gray-400">{text}</p>
}
