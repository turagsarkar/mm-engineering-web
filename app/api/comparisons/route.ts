import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { user, isAdmin: profile?.role === 'admin' }
}

// PATCH: edit a price comparison line (any signed-in user)
export async function PATCH(request: Request) {
  const { user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { line_id, price, lead_time, response_time, notes } = await request.json()
  if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (price !== undefined) {
    const p = parseFloat(price)
    updates.price = price === '' || price === null || isNaN(p) ? null : p
  }
  if (lead_time !== undefined) updates.lead_time = lead_time || null
  if (response_time !== undefined) updates.response_time = response_time || null
  if (notes !== undefined) updates.notes = notes || null

  const { error } = await adminClient().from('price_comparison_lines').update(updates).eq('id', line_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// DELETE: remove a whole comparison + its lines (admin only)
export async function DELETE(request: Request) {
  const { user, isAdmin } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Only admins can delete price comparisons' }, { status: 403 })

  const { comparison_id } = await request.json()
  if (!comparison_id) return NextResponse.json({ error: 'comparison_id required' }, { status: 400 })

  const admin = adminClient()
  await admin.from('price_comparison_lines').delete().eq('comparison_id', comparison_id)
  const { error } = await admin.from('price_comparisons').delete().eq('id', comparison_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
