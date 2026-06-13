'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/lib/hooks/useUser'
import { formatDateTime } from '@/lib/utils/format'
import type { Brand, Supplier } from '@/lib/types/database'

interface ExistingLine {
  id: string
  supplier_name: string | null
  price: number | null
  lead_time: string | null
  response_time: string | null
  notes: string | null
  created_at: string
  price_comparisons: {
    created_by: string | null
    created_at: string
    profiles: { full_name: string | null; email: string } | null
  } | null
}

export function PriceComparisonForm() {
  const { user, isAdmin } = useUser()
  const { toast } = useToast()
  const [partNumber, setPartNumber] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rows, setRows] = useState<Record<string, { price: string; leadTime: string; responseTime: string; notes: string }>>({})
  const [existing, setExisting] = useState<ExistingLine[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    fetchAllRows<Brand>((from, to) =>
      supabase.from('brands').select('*').order('name').range(from, to)
    ).then(setBrands)
  }, [])

  useEffect(() => {
    if (!selectedBrandId) { setSuppliers([]); return }
    createClient()
      .from('suppliers')
      .select('*')
      .eq('brand_id', selectedBrandId)
      .neq('traffic_light', 'red')
      .eq('supplier_status', 'active')
      .order('priority_rank')
      .then(({ data }) => {
        setSuppliers(data || [])
        const init: typeof rows = {}
        for (const s of data || []) {
          init[s.id] = { price: '', leadTime: '', responseTime: '', notes: '' }
        }
        setRows(init)
      })
  }, [selectedBrandId])

  useEffect(() => {
    if (!partNumber.trim() || !selectedBrandId) { setExisting([]); return }
    createClient()
      .from('price_comparison_lines')
      .select(`
        id, supplier_name, price, lead_time, response_time, notes, created_at,
        price_comparisons!inner(
          created_by, created_at, description,
          profiles(full_name, email)
        )
      `)
      .eq('price_comparisons.brand_id', selectedBrandId)
      .eq('price_comparisons.part_number', partNumber.trim())
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        // Hide lines belonging to comparisons still pending admin approval
        const rows = ((data as (ExistingLine & { price_comparisons: { description?: string | null } | null })[]) || [])
          .filter(l => l.price_comparisons?.description !== 'PENDING_APPROVAL')
        setExisting(rows as ExistingLine[])
      })
  }, [partNumber, selectedBrandId])

  function updateRow(supplierId: string, field: string, value: string) {
    setRows(prev => ({ ...prev, [supplierId]: { ...prev[supplierId], [field]: value } }))
  }

  async function handleSave() {
    if (!partNumber.trim() || !selectedBrandId) {
      toast('Enter a part number and select a brand', 'error')
      return
    }
    const entries = suppliers.filter(s => rows[s.id]?.price || rows[s.id]?.notes)
    if (entries.length === 0) {
      toast('Enter at least one price or note', 'error')
      return
    }
    setLoading(true)
    const supabase = createClient()

    // Comparisons under a brand with an open priority task need admin
    // approval first (members only).
    let needsApproval = false
    if (!isAdmin) {
      const { data: openTasks } = await supabase
        .from('priority_tasks')
        .select('id')
        .eq('brand_id', selectedBrandId)
        .eq('is_active', true)
        .limit(1)
      needsApproval = !!openTasks && openTasks.length > 0
    }

    const { data: header, error: headerErr } = await supabase
      .from('price_comparisons')
      .insert({
        brand_id: selectedBrandId,
        part_number: partNumber.trim(),
        created_by: user?.id,
        description: needsApproval ? 'PENDING_APPROVAL' : null,
      })
      .select('id')
      .single()

    if (headerErr || !header) {
      toast(headerErr?.message || 'Failed to save', 'error')
      setLoading(false)
      return
    }

    const lines = entries.map(s => ({
      comparison_id: header.id,
      supplier_id: s.id,
      supplier_name: s.name,
      supplier_email: s.email,
      price: rows[s.id]?.price ? (isNaN(parseFloat(rows[s.id].price)) ? null : parseFloat(rows[s.id].price)) : null,
      lead_time: rows[s.id]?.leadTime || null,
      response_time: rows[s.id]?.responseTime || null,
      notes: rows[s.id]?.notes || null,
    }))

    const { error: linesErr } = await supabase.from('price_comparison_lines').insert(lines)
    if (linesErr) {
      toast(linesErr.message, 'error')
    } else {
      // Points only when no approval is needed; the approval API logs
      // them when an admin approves a pending comparison.
      if (!needsApproval) {
        const brandName = brands.find(b => b.id === selectedBrandId)?.name
        await supabase.from('activity_log').insert({
          user_id: user?.id,
          action_type: 'price_comparison_added',
          entity_type: 'price_comparison',
          entity_id: header.id,
          entity_name: `${partNumber.trim()}${brandName ? ` — ${brandName}` : ''}`,
        })
      }
      toast(
        needsApproval
          ? 'Submitted — this brand has an open priority task, so an admin must approve it first'
          : 'Prices saved',
        'success'
      )
      setPartNumber('')
      setSelectedBrandId('')
      setSuppliers([])
      setRows({})
      setExisting([])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">New comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="part"
            label="Part number *"
            placeholder="e.g. 1SBL181001R8100"
            value={partNumber}
            onChange={e => setPartNumber(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="brand" className="text-sm font-medium text-gray-700">Brand *</label>
            <select
              id="brand"
              value={selectedBrandId}
              onChange={e => setSelectedBrandId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select brand…</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {suppliers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Supplier', 'Price', 'Lead time', 'Response', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="e.g. 12.50"
                        value={rows[s.id]?.price || ''}
                        onChange={e => updateRow(s.id, 'price', e.target.value)}
                        className="w-24 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input placeholder="e.g. 2 weeks"
                        value={rows[s.id]?.leadTime || ''}
                        onChange={e => updateRow(s.id, 'leadTime', e.target.value)}
                        className="w-28 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input placeholder="e.g. 1 day"
                        value={rows[s.id]?.responseTime || ''}
                        onChange={e => updateRow(s.id, 'responseTime', e.target.value)}
                        className="w-24 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input placeholder="Optional"
                        value={rows[s.id]?.notes || ''}
                        onChange={e => updateRow(s.id, 'notes', e.target.value)}
                        className="w-40 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4">
            <Button loading={loading} onClick={handleSave}>Save comparison</Button>
          </div>
        </div>
      )}

      {existing.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Previous results for &ldquo;{partNumber}&rdquo;
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {existing.map(line => (
              <div key={line.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                <span className="font-medium text-gray-900 w-40 truncate">{line.supplier_name}</span>
                <span className="text-gray-700">{line.price != null ? line.price : '—'}</span>
                <span className="text-gray-500">{line.lead_time || '—'}</span>
                {line.notes && <span className="text-gray-400 text-xs truncate">{line.notes}</span>}
                <span className="text-gray-400 text-xs ml-auto whitespace-nowrap">
                  {line.price_comparisons?.profiles?.full_name || line.price_comparisons?.profiles?.email} · {formatDateTime(line.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
