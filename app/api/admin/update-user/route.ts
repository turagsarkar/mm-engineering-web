import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, email, full_name, password } = await request.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (password && password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update auth record (email / password)
  const authUpdates: { email?: string; password?: string } = {}
  if (email) authUpdates.email = email
  if (password) authUpdates.password = password
  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await admin.auth.admin.updateUserById(user_id, {
      ...authUpdates,
      email_confirm: true,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Update profile record
  const profileUpdates: { email?: string; full_name?: string } = {}
  if (email) profileUpdates.email = email
  if (full_name !== undefined) profileUpdates.full_name = full_name || null
  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await admin.from('profiles').update(profileUpdates).eq('id', user_id)
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
