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

export function SearchBar() {
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
      supabase.from('suppliers').select('id,name,email,brand_id').ilike('name', term).limit(5),
    ])

    const r: SearchResult[] = [
      ...(brands || []).map(b => ({
        type: 'brand' as const, id: b.id, label: b.name, sub: 'Brand', slug: b.slug,
      })),
      ...(suppliers || []).map(s => ({
        type: 'supplier' as const, id: s.id, label: s.name, sub: s.email || 'Supplier',
      })),
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
    }
  }

  function clear() { setQuery(''); setResults([]); setOpen(false) }

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search brands or suppliers…"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
        />
        {query && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
          ) : (
            results.map(r => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className="flex items-start w-full px-4 py-2.5 hover:bg-gray-50 text-left gap-3"
              >
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 ${
                  r.type === 'brand' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {r.type}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.sub}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
