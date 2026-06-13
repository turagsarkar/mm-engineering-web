import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { Bot } from 'lucide-react'
import { AdminSuppliersClient } from '../suppliers/AdminSuppliersClient'

// AI Eligible = supplier is AI-approved AND its brand is not flagged "AI Do Not Quote"
export default async function AiEligiblePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, email, traffic_light, ai_approved, brand_id, brands!inner(name, slug, ai_do_not_quote)')
    .eq('ai_approved', true)
    .eq('supplier_status', 'active')
    .eq('brands.ai_do_not_quote', false)
    .order('name')
    .range(0, 4999)

  const count = suppliers?.length ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="AI Eligible Suppliers" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
            <Bot className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              These suppliers are approved for automatic AI quoting: the supplier is marked <strong>AI OK</strong> and
              the brand is not flagged &ldquo;AI Do Not Quote&rdquo;. <strong>{count}</strong> currently eligible.
            </p>
          </div>

          <AdminSuppliersClient suppliers={(suppliers as never[]) ?? []} />
        </div>
      </div>
    </div>
  )
}
