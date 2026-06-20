import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { AiDashboardClient } from './AiDashboardClient'

export interface EnquiryRow {
  id: string
  reference: string | null
  brand_detected: string | null
  brand_id: string | null
  supplier_id: string | null
  supplier_name: string | null
  status: string | null
  confidence: string | null
  processed_at: string | null
}

export interface ReviewRow {
  id: string
  reference: string | null
  reason_code: string | null
  brand_extracted: string | null
  email_subject: string | null
  status: string | null
  created_at: string | null
}

export default async function AiDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const [
    { count: aiApproved },
    { count: dnqBrands },
    enquiries,
    reviews,
  ] = await Promise.all([
    supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('ai_approved', true).eq('supplier_status', 'active'),
    supabase.from('brands').select('*', { count: 'exact', head: true }).eq('ai_do_not_quote', true),
    fetchAllRows<EnquiryRow>((from, to) =>
      // @ts-expect-error enquiry_log columns not in generated types
      supabase.from('enquiry_log')
        .select('id, reference, brand_detected, brand_id, supplier_id, supplier_name, status, confidence, processed_at')
        .order('processed_at', { ascending: false }).range(from, to)
    ),
    fetchAllRows<ReviewRow>((from, to) =>
      // @ts-expect-error manual_review_queue columns not in generated types
      supabase.from('manual_review_queue')
        .select('id, reference, reason_code, brand_extracted, email_subject, status, created_at')
        .order('created_at', { ascending: false }).range(from, to)
    ),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="AI Performance" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <AiDashboardClient
            aiApproved={aiApproved ?? 0}
            dnqBrands={dnqBrands ?? 0}
            enquiries={enquiries}
            reviews={reviews}
          />
        </div>
      </div>
    </div>
  )
}
