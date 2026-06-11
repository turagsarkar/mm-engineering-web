import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { Bot, Mail, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'

export default async function AiDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const [
    { count: aiApproved },
    { count: dnqBrands },
    { count: enquiriesSent },
    { count: reviewQueueOpen },
    { data: topUsed },
  ] = await Promise.all([
    supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('ai_approved', true).eq('supplier_status', 'active'),
    supabase.from('brands').select('*', { count: 'exact', head: true }).eq('ai_do_not_quote', true),
    supabase.from('enquiry_log').select('*', { count: 'exact', head: true }),
    supabase.from('manual_review_queue').select('*', { count: 'exact', head: true }).eq('resolved', false),
    supabase.from('suppliers').select('id, name, ai_usage_counter, brands(name)').gt('ai_usage_counter', 0).order('ai_usage_counter', { ascending: false }).limit(10),
  ])

  const stats = [
    { label: 'AI-Approved Suppliers', value: aiApproved ?? 0, icon: Bot, color: 'bg-green-50 text-green-600 border-green-100' },
    { label: 'AI Do Not Quote Brands', value: dnqBrands ?? 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600 border-red-100' },
    { label: 'AI Enquiries Sent', value: enquiriesSent ?? 0, icon: Mail, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: 'Pending Manual Review', value: reviewQueueOpen ?? 0, icon: CheckCircle, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  ]

  const usedRows = (topUsed ?? []) as unknown as { id: string; name: string; ai_usage_counter: number; brands: { name: string } | null }[]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="AI Performance" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{s.value.toLocaleString()}</p>
                    </div>
                    <div className={`p-2 rounded-lg border ${s.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Most-used suppliers by AI</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {usedRows.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-gray-500">No AI usage recorded yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Usage counters increase when the AI workflow sends enquiries to suppliers.
                  </p>
                </div>
              ) : (
                usedRows.map(s => (
                  <Link key={s.id} href={`/suppliers/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.brands?.name}</p>
                    </div>
                    <span className="font-semibold text-blue-600">{s.ai_usage_counter} uses</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/ai-eligible" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Bot className="h-4 w-4" />
              View AI Eligible Suppliers
            </Link>
            <Link href="/brands?filter=ai_do_not_quote" className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
              <AlertTriangle className="h-4 w-4" />
              AI Do Not Quote Brands
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
