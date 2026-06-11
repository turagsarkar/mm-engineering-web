import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { Bot, ChevronRight } from 'lucide-react'

// AI Eligible = supplier is AI-approved AND its brand is not flagged "AI Do Not Quote"
export default async function AiEligiblePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, email, priority_rank, traffic_light, brands!inner(name, slug, ai_do_not_quote)')
    .eq('ai_approved', true)
    .eq('supplier_status', 'active')
    .eq('brands.ai_do_not_quote', false)
    .order('name')
    .range(0, 4999)

  const rows = (suppliers ?? []) as unknown as {
    id: string; name: string; email: string | null; priority_rank: number
    traffic_light: string | null
    brands: { name: string; slug: string; ai_do_not_quote: boolean }
  }[]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="AI Eligible Suppliers" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
            <Bot className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              These suppliers are approved for automatic AI quoting: the supplier is marked <strong>AI OK</strong> and
              the brand is not flagged &ldquo;AI Do Not Quote&rdquo;. <strong>{rows.length}</strong> currently eligible.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-500">No AI eligible suppliers yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Approve suppliers with the AI toggle on any brand page to add them here.
                </p>
              </div>
            ) : (
              rows.map(s => (
                <Link
                  key={s.id}
                  href={`/suppliers/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    s.traffic_light === 'amber' ? 'bg-amber-400' : s.traffic_light === 'red' ? 'bg-red-500' : 'bg-green-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.brands.name}{s.email ? ` · ${s.email}` : ''}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
