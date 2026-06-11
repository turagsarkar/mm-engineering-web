import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { AdminSuppliersClient } from './AdminSuppliersClient'

export default async function AdminSuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, email, traffic_light, ai_approved, brand_id, brands(name, slug)')
    .eq('supplier_status', 'active')
    .order('name')
    .range(0, 4999)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="All Active Suppliers" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <AdminSuppliersClient suppliers={(suppliers as never[]) ?? []} />
        </div>
      </div>
    </div>
  )
}
