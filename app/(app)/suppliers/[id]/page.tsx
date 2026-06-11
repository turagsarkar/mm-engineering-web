import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import Link from 'next/link'
import { Edit2, Phone, ArrowLeft } from 'lucide-react'
import { CopyEmailButton } from '@/components/supplier/CopyEmailButton'

interface Props {
  params: Promise<{ id: string }>
}

const TL_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  green:  { label: 'Green – Primary Supplier',          dot: 'bg-green-500', bg: 'bg-green-50',  text: 'text-green-700' },
  amber:  { label: 'Amber – Alternative/Stock Supplier', dot: 'bg-amber-400', bg: 'bg-amber-50',  text: 'text-amber-700' },
  red:    { label: 'Red – Do Not Use',                   dot: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700' },
}

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: supplier }, ] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).single(),
  ])

  if (!supplier) notFound()

  const [{ data: brand }, { data: notes }] = await Promise.all([
    supabase.from('brands').select('id, name, slug').eq('id', supplier.brand_id).single(),
    supabase
      .from('supplier_notes')
      .select('id, note_type, note_text, created_at')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false }),
  ])

  const tl = TL_LABEL[supplier.traffic_light ?? 'green'] ?? TL_LABEL.green

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={supplier.name} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-4">

          {/* Back link */}
          {brand && (
            <Link
              href={`/brands/${brand.slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {brand.name}
            </Link>
          )}

          {/* Main card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{supplier.name}</h2>
                {brand && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    Brand: <Link href={`/brands/${brand.slug}`} className="text-blue-600 hover:underline">{brand.name}</Link>
                  </p>
                )}
              </div>
              <Link
                href={`/suppliers/${id}/edit`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Link>
            </div>

            {/* Traffic light */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${tl.bg} mb-4`}>
              <span className={`w-2.5 h-2.5 rounded-full ${tl.dot}`} />
              <span className={`text-xs font-medium ${tl.text}`}>{tl.label}</span>
            </div>

            {/* Details grid */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {supplier.email && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-0.5">Email (click to copy)</dt>
                  <dd className="text-sm">
                    <CopyEmailButton email={supplier.email} />
                  </dd>
                </div>
              )}
              {supplier.contact_name && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-0.5">Contact</dt>
                  <dd className="flex items-center gap-1.5 text-gray-900">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {supplier.contact_name}
                  </dd>
                </div>
              )}
              {supplier.margin && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-0.5">Margin</dt>
                  <dd className="text-gray-900">{supplier.margin}</dd>
                </div>
              )}
              {supplier.where_to_look && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-0.5">Where to look</dt>
                  <dd className="text-gray-900">{supplier.where_to_look}</dd>
                </div>
              )}
              {supplier.po_number && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-0.5">Previous PO</dt>
                  <dd className="text-gray-900">{supplier.po_number}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Status</dt>
                <dd>
                  <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                    supplier.supplier_status === 'active'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {supplier.supplier_status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">AI approved</dt>
                <dd>
                  <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                    supplier.ai_approved
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {supplier.ai_approved ? 'Yes — OK to quote' : 'No — Do not quote'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          {notes && notes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {notes.map(note => (
                  <div key={note.id} className="px-4 py-3">
                    {note.note_type && note.note_type !== 'general' && (
                      <span className="text-xs font-medium text-blue-600 capitalize mb-1 block">{note.note_type}</span>
                    )}
                    <p className="text-sm text-gray-800">{note.note_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
