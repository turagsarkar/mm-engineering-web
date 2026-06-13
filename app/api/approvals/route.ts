import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Entries submitted under a priority brand wait for admin approval:
//   suppliers   -> supplier_status = 'pending'
//   comparisons -> description = 'PENDING_APPROVAL'
// Approve: entry goes live + points logged to the submitter.
// Reject: entry is deleted.

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

// GET: list pending entries (admin only)
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = adminClient()
  const [{ data: suppliers }, { data: comparisons }] = await Promise.all([
    admin
      .from('suppliers')
      .select('id, name, email, traffic_light, created_at, added_by, brands(name, slug), profiles:added_by(full_name, email)')
      .eq('supplier_status', 'pending')
      .order('created_at', { ascending: false }),
    admin
      .from('price_comparisons')
      .select('id, part_number, created_at, created_by, brands(name, slug), profiles:created_by(full_name, email)')
      .eq('description', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({ suppliers: suppliers ?? [], comparisons: comparisons ?? [] })
}

// POST: approve or reject one entry (admin only)
export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { type, id, action } = await request.json()
  if (!['supplier', 'comparison'].includes(type) || !id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'type (supplier|comparison), id and action (approve|reject) required' }, { status: 400 })
  }

  const admin = adminClient()

  if (type === 'supplier') {
    const { data: sup } = await admin.from('suppliers').select('id, name, added_by, supplier_status').eq('id', id).single()
    if (!sup || sup.supplier_status !== 'pending') {
      return NextResponse.json({ error: 'Pending supplier not found' }, { status: 404 })
    }
    if (action === 'approve') {
      const { error } = await admin.from('suppliers').update({ supplier_status: 'active' }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      await admin.from('activity_log').insert({
        user_id: sup.added_by,
        action_type: 'supplier_added',
        entity_type: 'supplier',
        entity_id: sup.id,
        entity_name: sup.name,
        details: { approved_by: user.id },
      })
    } else {
      await admin.from('supplier_notes').delete().eq('supplier_id', id)
      const { error } = await admin.from('suppliers').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
  } else {
    const { data: comp } = await admin.from('price_comparisons').select('id, part_number, created_by, description, brands(name)').eq('id', id).single()
    if (!comp || comp.description !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Pending comparison not found' }, { status: 404 })
    }
    if (action === 'approve') {
      const { error } = await admin.from('price_comparisons').update({ description: null }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      const brandRel = comp.brands as unknown as { name: string } | { name: string }[] | null
      const brandName = Array.isArray(brandRel) ? brandRel[0]?.name : brandRel?.name
      await admin.from('activity_log').insert({
        user_id: comp.created_by,
        action_type: 'price_comparison_added',
        entity_type: 'price_comparison',
        entity_id: comp.id,
        entity_name: `${comp.part_number}${brandName ? ` — ${brandName}` : ''}`,
        details: { approved_by: user.id },
      })
    } else {
      await admin.from('price_comparison_lines').delete().eq('comparison_id', id)
      const { error } = await admin.from('price_comparisons').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
