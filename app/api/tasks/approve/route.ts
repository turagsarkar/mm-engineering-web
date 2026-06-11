import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Approve or reject a completed priority task.
// Approve: closes the task and awards 3 points to the completer (task_completed activity).
// Reject: clears the completion so the task stays active.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { task_id, action } = await request.json()
  if (!task_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'task_id and action (approve|reject) required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: task } = await admin
    .from('priority_tasks')
    .select('id, message, completed_by, completed_at, is_active')
    .eq('id', task_id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (!task.completed_at) return NextResponse.json({ error: 'Task is not pending approval' }, { status: 400 })

  if (action === 'approve') {
    const { error } = await admin.from('priority_tasks').update({ is_active: false }).eq('id', task_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Award 3 points to whoever completed it
    await admin.from('activity_log').insert({
      user_id: task.completed_by,
      action_type: 'task_completed',
      entity_type: 'priority_task',
      entity_id: task.id,
      entity_name: (task.message || '').slice(0, 80),
      details: { approved_by: user.id },
    })
  } else {
    const { error } = await admin
      .from('priority_tasks')
      .update({ completed_by: null, completed_at: null })
      .eq('id', task_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
