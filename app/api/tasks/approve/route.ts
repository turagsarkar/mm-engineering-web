import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Priority tasks stay open until an admin closes them. Points are earned from
// the approved entries (suppliers / price comparisons) under the brand — 3 pts
// each — so closing a task simply marks it complete with NO extra points
// (this avoids the double-counting the client flagged).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { task_id, action } = await request.json()
  if (!task_id || action !== 'close') {
    return NextResponse.json({ error: 'task_id and action (close) required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: task } = await admin
    .from('priority_tasks')
    .select('id, is_active')
    .eq('id', task_id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (!task.is_active) return NextResponse.json({ error: 'Task already closed' }, { status: 400 })

  const { error } = await admin.from('priority_tasks').update({
    is_active: false,
    completed_by: user.id,
    completed_at: new Date().toISOString(),
  }).eq('id', task_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
