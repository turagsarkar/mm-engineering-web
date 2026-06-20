'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Bot, AlertTriangle, Mail, ClipboardCheck, Tag, Truck, Download, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'
import type { EnquiryRow, ReviewRow } from './page'

type Period = '1w' | '1m' | '3m' | 'all' | 'custom'
type Tab = 'brands' | 'suppliers' | 'enquiries' | 'reviews'

const PERIOD_LABEL: Record<Period, string> = {
  '1w': '1 week', '1m': '1 month', '3m': '3 months', all: 'All time', custom: 'Custom',
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
  enquiries: EnquiryRow[]
  reviews: ReviewRow[]
}

export function AiDashboardClient({ aiApproved, dnqBrands, enquiries, reviews }: Props) {
  const { toast } = useToast()
  const [period, setPeriod] = useState<Period>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [tab, setTab] = useState<Tab>('brands')
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

  const enqSent = useMemo(() => enquiries.filter(e => inPeriod(e.processed_at)), [enquiries, period, customFrom, customTo])
  const reviewsFiltered = useMemo(() => reviews.filter(r => inPeriod(r.created_at)), [reviews, period, customFrom, customTo])
  const pendingReviews = reviewsFiltered.filter(r => (r.status ?? 'pending') === 'pending')

  // Rankings
  function rank(items: string[]): { name: string; count: number }[] {
    const m = new Map<string, number>()
    for (const x of items) {
      const k = (x || 'Unknown').trim()
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }
  const topBrands = useMemo(() => rank(enqSent.map(e => e.brand_detected || 'Unknown')), [enqSent])
  const topSuppliers = useMemo(() => rank(enqSent.map(e => e.supplier_name || 'Unknown')), [enqSent])

  const cards = [
    { id: 'ai_approved', label: 'AI-Approved Suppliers', value: aiApproved, icon: Bot, color: 'bg-green-50 text-green-600 border-green-100', href: '/admin/ai-eligible', tab: null },
    { id: 'dnq', label: 'AI Do Not Quote Brands', value: dnqBrands, icon: AlertTriangle, color: 'bg-red-50 text-red-600 border-red-100', href: '/brands?filter=ai_do_not_quote', tab: null },
    { id: 'enquiries', label: 'AI Enquiries Sent', value: enqSent.length, icon: Mail, color: 'bg-blue-50 text-blue-600 border-blue-100', href: null, tab: 'enquiries' as Tab },
    { id: 'reviews', label: 'Pending Manual Review', value: pendingReviews.length, icon: ClipboardCheck, color: 'bg-orange-50 text-orange-600 border-orange-100', href: null, tab: 'reviews' as Tab },
  ]

  const tabs: { id: Tab; label: string; icon: typeof Tag; count: number }[] = [
    { id: 'brands', label: 'Top Brands AI Used', icon: Tag, count: topBrands.length },
    { id: 'suppliers', label: 'Top Suppliers AI Used', icon: Truck, count: topSuppliers.length },
    { id: 'enquiries', label: 'Enquiries Sent', icon: Mail, count: enqSent.length },
    { id: 'reviews', label: 'Pending Review', icon: ClipboardCheck, count: pendingReviews.length },
  ]

  // ---- CSV exports (#51) ----
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
    downloadCsv('brands', 'Brand,Aliases,AI Do Not Quote,Confirmed Suppliers,Last Reviewed,Next Review',
      rows.map(b => [esc(b.name), esc((b.aliases || []).join(' | ')), b.ai_do_not_quote ? 'Yes' : 'No', b.confirmed_suppliers ? 'Yes' : 'No', esc(b.last_reviewed_at || ''), esc(b.next_review_at || '')].join(',')))
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
    setExporting('enquiries')
    downloadCsv('ai-enquiries', 'Reference,Brand,Supplier,Status,Confidence,Sent',
      enqSent.map(e => [esc(e.reference || ''), esc(e.brand_detected || ''), esc(e.supplier_name || ''), esc(e.status || ''), esc(e.confidence || ''), esc(e.processed_at || '')].join(',')))
    setExporting(null)
  }

  return (
    <div className="space-y-6">
      {/* Time period filter — applies to all selections (#53) */}
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

      {/* Stat cards — clickable where they have a drill-down (#54) */}
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

      {/* Exports (#51) */}
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

      {/* Selectable tabs (#54) */}
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

      {/* Tab content — full ranked list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tab === 'brands' && (
          <RankedList title="Top brands the AI used (ranked)" rows={topBrands} unit="enquiries" empty="No AI enquiries in this period" />
        )}
        {tab === 'suppliers' && (
          <RankedList title="Top suppliers the AI used (ranked)" rows={topSuppliers} unit="enquiries" empty="No AI enquiries in this period" />
        )}
        {tab === 'enquiries' && (
          <div>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">AI enquiries sent ({enqSent.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
              {enqSent.length === 0 ? <Empty text="No enquiries sent in this period" /> :
                enqSent.map(e => (
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
