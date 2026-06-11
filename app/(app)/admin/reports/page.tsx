import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').order('full_name')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Activity Reports" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <ReportsClient profiles={profiles ?? []} />
        </div>
      </div>
    </div>
  )
}
