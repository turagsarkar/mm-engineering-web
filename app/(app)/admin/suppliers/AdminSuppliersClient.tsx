'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, X, ChevronRight, ChevronLeft, Bot, Download } from 'lucide-react'

interface SupplierRow {
  id: string
  name: string
  email: string | null
  contact_name?: string | null
  margin?: string | null
  where_to_look?: string | null
  po_number?: string | null
  traffic_light: string | null
  ai_approved: boolean
  brands: { name: string; slug: string } | null
}

const TL_DOT: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
}

const PAGE_SIZE = 100

export function AdminSuppliersClient({ suppliers }: { suppliers: SupplierRow[] }) {
  const [query, setQuery] = useState('')
  const [tlFilter, setTlFilter] = useState('')
  const [page, setPage] = useState(1)

  const filtered = suppliers.filter(s => {
    const matchQ = !query.trim() ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(query.toLowerCase()) ||
      (s.brands?.name || '').toLowerCase().includes(query.toLowerCase())
    const matchTl = !tlFilter || (s.traffic_light ?? 'green') === tlFilter
    return matchQ && matchTl
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(1) }, [query, tlFilter])
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // #51 Export the current (filtered) supplier list to CSV
  function exportCsv() {
    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
    const header = 'Supplier,Brand,Email,Contact,Margin,Where to look,Previous PO,Priority,AI Approved\n'
    const tlLabel: Record<string, string> = { green: 'Primary', amber: 'Alternative/Stock', red: 'Do Not Use' }
    const body = filtered.map(s => [
      esc(s.name),
      esc(s.brands?.name || ''),
      esc(s.email || ''),
      esc(s.contact_name || ''),
      esc(s.margin || ''),
      esc(s.where_to_look || ''),
      esc(s.po_number || ''),
      esc(tlLabel[s.traffic_light ?? 'green'] || ''),
      s.ai_approved ? 'Yes' : 'No',
    ].join(',')).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suppliers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${suppliers.length} suppliers…`}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {['', 'green', 'amber', 'red'].map(tl => (
            <button
              key={tl || 'all'}
              onClick={() => setTlFilter(tl)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors capitalize ${
                tlFilter === tl
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {tl || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
          {totalPages > 1 && ` — showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)}`}
        </p>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV ({filtered.length})
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No suppliers match</p>
        ) : (
          pageRows.map(s => (
            <Link
              key={s.id}
              href={`/suppliers/${s.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TL_DOT[s.traffic_light ?? 'green']}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {s.brands?.name}{s.email ? ` · ${s.email}` : ''}
                </p>
              </div>
              {s.ai_approved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded shrink-0">
                  <Bot className="h-3 w-3" /> AI OK
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
            .map((n, i, arr) => (
              <span key={n} className="flex items-center gap-2">
                {i > 0 && arr[i - 1] !== n - 1 && <span className="text-gray-300 text-xs">…</span>}
                <button
                  onClick={() => setPage(n)}
                  className={`text-xs w-8 h-8 rounded-lg border transition-colors ${
                    n === safePage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              </span>
            ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
