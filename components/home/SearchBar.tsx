'use client'
import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SearchResult {
  type: 'brand' | 'supplier'
  id: string
  label: string
  sub: string
  slug?: string
}

function useDebounce(fn: (v: string) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  return useCallback((v: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(v), delay)
  }, [fn, delay])
}

interface SearchBarProps {
  compact?: boolean
}

export function SearchBar({ compact }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    const supabase = createClient()
    const term = `%${q}%`

    const [{ data: brands }, { data: suppliers }] = await Promise.all([
      supabase.from('brands').select('id,name,slug').ilike('name', term).limit(5),
      supabase
        .from('suppliers')
        .select('id,name,email,brand_id,brands(name,slug)')
        .ilike('name', term)
        .neq('supplier_status', 'pending')
        .limit(20),
    ]).catch(() => [{ data: [] }, { data: [] }])

    // Deduplicate suppliers by name — keep first occurrence per unique name
    const seenNames = new Set<string>()
    const uniqueSuppliers: SearchResult[] = []
    for (const s of (suppliers || []) as { id: string; name: string; email: string | null; brand_id: string; brands: { name: string; slug: string } | null }[]) {
      const key = s.name.toLowerCase()
      if (!seenNames.has(key)) {
        seenNames.add(key)
        uniqueSuppliers.push({
          type: 'supplier',
          id: s.id,
          label: s.name,
          sub: s.brands ? s.brands.name : (s.email || 'Supplier'),
        })
      }
    }

    const r: SearchResult[] = [
      ...(brands || []).map(b => ({
        type: 'brand' as const, id: b.id, label: b.name, sub: 'Brand', slug: b.slug,
      })),
      ...uniqueSuppliers.slice(0, 5),
    ]
    setResults(r)
    setOpen(r.length > 0)
    setLoading(false)
  }, [])

  const debouncedSearch = useDebounce(search, 300)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    debouncedSearch(v)
  }

  function handleSelect(r: SearchResult) {
    setOpen(false)
    setQuery('')
    if (r.type === 'brand' && r.slug) {
      router.push(`/brands/${r.slug}`)
    } else if (r.type === 'supplier') {
      router.push(`/suppliers/${r.id}`)
    }
  }

  function clear() { setQuery(''); setResults([]); setOpen(false) }

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
        <div className="absolute z-50 mt-1 w-full min-w-[260px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
          ) : (
            results.map(r => (
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
        </div>
      )}
    </div>
  )
}
