import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { UserManagerClient } from './UserManagerClient'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, last_login, created_at, updated_at')
    .order('role')
    .order('email')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="User Management" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <UserManagerClient users={users ?? []} currentUserId={user.id} />
        </div>
      </div>
    </div>
  )
}
