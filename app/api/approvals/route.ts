import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Entries submitted under a priority brand wait for admin approval:
//   suppliers   -> held as JSON in activity_log (action_type 'pending_supplier'),
//                  NOT in the suppliers table until approved
//   comparisons -> price_comparisons.description = 'PENDING_APPROVAL'
// Approve: entry goes live + points logged to the submitter.
// Reject: entry is discarded.

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
  const [{ data: pendingSuppliers }, { data: comparisons }] = await Promise.all([
    admin
      .from('activity_log')
      .select('id, entity_name, created_at, user_id, details, profiles:user_id(full_name, email)')
      .eq('action_type', 'pending_supplier')
      .order('created_at', { ascending: false }),
    admin
      .from('price_comparisons')
      .select('id, part_number, created_at, created_by, brands(name, slug), profiles:created_by(full_name, email)')
      .eq('description', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false }),
  ])

  // Reshape pending suppliers (stored as JSON) — include the FULL entry so the
  // admin can review every field before approving.
  const suppliers = (pendingSuppliers ?? []).map(row => {
    const d = (row.details ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      name: row.entity_name,
      email: (d.email as string) ?? null,
      contact_name: (d.contact_name as string) ?? null,
      margin: (d.margin as string) ?? null,
      where_to_look: (d.where_to_look as string) ?? null,
      po_number: (d.po_number as string) ?? null,
      traffic_light: (d.traffic_light as string) ?? 'green',
      notes: (d.notes as string) ?? null,
      created_at: row.created_at,
      brands: { name: (d.brand_name as string) ?? 'Unknown brand', slug: (d.brand_slug as string) ?? '' },
      profiles: row.profiles,
    }
  })

  // Attach the price lines to each pending comparison so the admin sees the full quote
  const comparisonsWithLines = await Promise.all((comparisons ?? []).map(async c => {
    const { data: lines } = await admin
      .from('price_comparison_lines')
      .select('id, supplier_name, price, lead_time, response_time, notes')
      .eq('comparison_id', c.id)
      .order('price', { ascending: true })
    return { ...c, lines: lines ?? [] }
  }))

  return NextResponse.json({ suppliers, comparisons: comparisonsWithLines })
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
    // id is the activity_log holding-row id
    const { data: row } = await admin
      .from('activity_log')
      .select('id, user_id, entity_name, details, action_type')
      .eq('id', id)
      .single()
    if (!row || row.action_type !== 'pending_supplier') {
      return NextResponse.json({ error: 'Pending supplier not found' }, { status: 404 })
    }

    if (action === 'approve') {
      const d = (row.details ?? {}) as Record<string, unknown>
      const { data: created, error } = await admin.from('suppliers').insert({
        brand_id: d.brand_id as string,
        name: d.name as string,
        email: (d.email as string) ?? null,
        contact_name: (d.contact_name as string) ?? null,
        margin: (d.margin as string) ?? null,
        where_to_look: (d.where_to_look as string) ?? null,
        po_number: (d.po_number as string) ?? null,
        traffic_light: (d.traffic_light as string) ?? 'green',
        priority_rank: (d.priority_rank as number) ?? 1,
        supplier_status: 'active',
        added_by: row.user_id,
      }).select('id').single()
      if (error || !created) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 400 })

      if (d.notes) {
        await admin.from('supplier_notes').insert({
          supplier_id: created.id,
          note_type: 'general',
          note_text: d.notes as string,
          created_by: row.user_id,
        })
      }

      // Approved work under a priority brand counts as priority-task work = 3 pts
      // (not the base 1pt for a supplier), then remove the holding row.
      await admin.from('activity_log').insert({
        user_id: row.user_id,
        action_type: 'task_completed',
        entity_type: 'supplier',
        entity_id: created.id,
        entity_name: `Supplier: ${row.entity_name}`,
        details: { approved_by: user.id, source: 'priority_supplier' },
      })
      await admin.from('activity_log').delete().eq('id', id)
    } else {
      await admin.from('activity_log').delete().eq('id', id)
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
      // Approved comparison under a priority brand = priority-task work = 3 pts
      // (not the base 2pts for a comparison).
      await admin.from('activity_log').insert({
        user_id: comp.created_by,
        action_type: 'task_completed',
        entity_type: 'price_comparison',
        entity_id: comp.id,
        entity_name: `Price comparison: ${comp.part_number}${brandName ? ` — ${brandName}` : ''}`,
        details: { approved_by: user.id, source: 'priority_comparison' },
      })
    } else {
      await admin.from('price_comparison_lines').delete().eq('comparison_id', id)
      const { error } = await admin.from('price_comparisons').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
