'use client'
import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Tag, Truck, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SearchResult {
  type: 'brand' | 'supplier'
  id: string
  label: string
  sub: string
  slug?: string
  score: number
}

type FilterType = 'all' | 'brand' | 'supplier'

const MAX_RESULTS = 10

function useDebounce(fn: (v: string) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  return useCallback((v: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(v), delay)
  }, [fn, delay])
}

// Relevance: exact > starts-with > a word starts-with > contains.
// This is what stops "A" from matching "3M Tape" (only a mid-word 'a')
// while keeping "Abb" → "ABB Motors" near the top.
function relevance(name: string, q: string): number {
  const n = name.toLowerCase()
  const s = q.toLowerCase()
  if (n === s) return 100
  if (n.startsWith(s)) return 80
  if (n.split(/[^a-z0-9]+/).some(w => w.startsWith(s))) return 60
  if (n.includes(s)) return 20
  return 0
}

interface SearchBarProps {
  compact?: boolean
}

export function SearchBar({ compact }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const lastQuery = useRef('')

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    lastQuery.current = trimmed
    if (!trimmed) { setResults([]); setOpen(false); return }
    setLoading(true)
    const supabase = createClient()
    const prefix = `${trimmed}%`
    const contains = `%${trimmed}%`

    // Two passes per entity: prefix matches (most relevant, bounded) and
    // contains matches (catches words mid-name like "Motors"). Ordered by
    // name so results are deterministic, then re-ranked client-side.
    const [bPrefix, bContains, sPrefix, sContains] = await Promise.all([
      supabase.from('brands').select('id,name,slug').ilike('name', prefix).order('name').limit(25),
      supabase.from('brands').select('id,name,slug').ilike('name', contains).order('name').limit(25),
      supabase.from('suppliers').select('id,name,email,brands(name,slug)').ilike('name', prefix).neq('supplier_status', 'pending').order('name').limit(40),
      supabase.from('suppliers').select('id,name,email,brands(name,slug)').ilike('name', contains).neq('supplier_status', 'pending').order('name').limit(40),
    ]).catch(() => [{ data: [] }, { data: [] }, { data: [] }, { data: [] }])

    // Ignore stale responses (a newer keystroke already fired)
    if (lastQuery.current !== trimmed) return

    // Merge + dedup brands by id
    const brandMap = new Map<string, { id: string; name: string; slug: string }>()
    for (const b of [...(bPrefix.data || []), ...(bContains.data || [])] as { id: string; name: string; slug: string }[]) {
      if (!brandMap.has(b.id)) brandMap.set(b.id, b)
    }
    const brandResults: SearchResult[] = [...brandMap.values()].map(b => ({
      type: 'brand', id: b.id, label: b.name, sub: 'Brand', slug: b.slug,
      score: relevance(b.name, trimmed),
    }))

    // Merge suppliers, dedup by NAME (Routeco serves many brands → one entry)
    const seenNames = new Set<string>()
    const supplierResults: SearchResult[] = []
    for (const s of [...(sPrefix.data || []), ...(sContains.data || [])] as { id: string; name: string; email: string | null; brands: { name: string; slug: string } | null }[]) {
      const key = s.name.toLowerCase()
      if (seenNames.has(key)) continue
      seenNames.add(key)
      supplierResults.push({
        type: 'supplier', id: s.id, label: s.name,
        sub: s.brands ? s.brands.name : (s.email || 'Supplier'),
        score: relevance(s.name, trimmed),
      })
    }

    const combined = [...brandResults, ...supplierResults]
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))

    setResults(combined)
    setOpen(true)
    setLoading(false)
  }, [])

  const debouncedSearch = useDebounce(search, 250)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    debouncedSearch(v)
  }

  function handleSelect(r: SearchResult) {
    setOpen(false)
    setQuery('')
    if (r.type === 'brand' && r.slug) router.push(`/brands/${r.slug}`)
    else if (r.type === 'supplier') router.push(`/suppliers/${r.id}`)
  }

  function clear() { setQuery(''); setResults([]); setOpen(false) }

  function handleAddBrand() {
    const name = query.trim()
    setOpen(false)
    setQuery('')
    router.push(`/brands/new?name=${encodeURIComponent(name)}`)
  }

  const filtered = (filter === 'all' ? results : results.filter(r => r.type === filter)).slice(0, MAX_RESULTS)
  const brandCount = results.filter(r => r.type === 'brand').length
  const supplierCount = results.filter(r => r.type === 'supplier').length

  // Offer "Add brand" whenever the typed name isn't an exact brand match — lets
  // the user create an unrecognised brand without leaving the search.
  const trimmedQuery = query.trim()
  const hasExactBrand = results.some(r => r.type === 'brand' && r.label.toLowerCase() === trimmedQuery.toLowerCase())
  const canAddBrand = trimmedQuery.length > 0 && !hasExactBrand

  const pills: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: results.length },
    { id: 'brand', label: 'Brands', count: brandCount },
    { id: 'supplier', label: 'Suppliers', count: supplierCount },
  ]

  return (
    <div className={`relative ${compact ? 'w-full' : 'w-full max-w-xl'}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search brands or suppliers…"
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
        />
        {query && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[300px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Filter pills */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50">
            {pills.map(p => (
              <button
                key={p.id}
                onClick={() => setFilter(p.id)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                  filter === p.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {p.id === 'brand' && <Tag className="h-3 w-3" />}
                {p.id === 'supplier' && <Truck className="h-3 w-3" />}
                {p.label}
                <span className={filter === p.id ? 'opacity-90' : 'text-gray-400'}>{p.count}</span>
              </button>
            ))}
            {/* "Add" tab — create an unrecognised brand without leaving search */}
            {canAddBrand && (
              <button
                onClick={handleAddBrand}
                className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
            ) : filtered.length === 0 ? (
              <div>
                <div className="px-4 py-3 text-sm text-gray-400">No matches for &ldquo;{query}&rdquo;</div>
                {canAddBrand && (
                  <button
                    onClick={handleAddBrand}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 border-t border-gray-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add &ldquo;{trimmedQuery}&rdquo; as a new brand
                  </button>
                )}
              </div>
            ) : (
              filtered.map(r => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className="flex items-start w-full px-4 py-2.5 hover:bg-gray-50 text-left gap-3"
                >
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                    r.type === 'brand' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                    <p className="text-xs text-gray-500 truncate">{r.sub}</p>
                  </div>
                </button>
              ))
            )}
            {/* Add-brand footer when results exist but none is an exact brand match */}
            {!loading && filtered.length > 0 && canAddBrand && (
              <button
                onClick={handleAddBrand}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 border-t border-gray-100"
              >
                <Plus className="h-4 w-4" />
                Add &ldquo;{trimmedQuery}&rdquo; as a new brand
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
