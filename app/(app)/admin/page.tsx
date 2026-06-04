import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { Users, Tag, Truck, Bot, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const [
    { count: brandCount },
    { count: supplierCount },
    { count: aiEligibleCount },
    { count: doNotQuoteCount },
    { count: reviewDueCount },
    { count: memberCount },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('brands').select('*', { count: 'exact', head: true }),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('supplier_status', 'active'),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('ai_approved', true).eq('supplier_status', 'active'),
    supabase.from('brands').select('*', { count: 'exact', head: true }).eq('ai_do_not_quote', true),
    supabase.from('brands').select('*', { count: 'exact', head: true }).or(`last_reviewed_at.is.null,last_reviewed_at.lt.${new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()}`),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('activity_log').select('action_type, entity_name, created_at, profiles(full_name, email)').order('created_at', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Total Brands', value: brandCount ?? 0, icon: Tag, color: 'blue', href: '/brands' },
    { label: 'Active Suppliers', value: supplierCount ?? 0, icon: Truck, color: 'green', href: '/brands' },
    { label: 'AI Eligible', value: aiEligibleCount ?? 0, icon: Bot, color: 'purple', href: '/brands' },
    { label: 'Do Not Quote', value: doNotQuoteCount ?? 0, icon: AlertTriangle, color: 'red', href: '/brands' },
    { label: 'Review Overdue', value: reviewDueCount ?? 0, icon: AlertTriangle, color: 'orange', href: '/brands?filter=review_due' },
    { label: 'Team Members', value: memberCount ?? 0, icon: Users, color: 'gray', href: '/admin/users' },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Admin Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map(stat => {
            const Icon = stat.icon
            return (
              <Link key={stat.label} href={stat.href} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value.toLocaleString()}</p>
                  </div>
                  <div className={`p-2 rounded-lg border ${colorMap[stat.color]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/users" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Users className="h-4 w-4" />
              Manage Users
            </Link>
            <Link href="/brands/new" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              <Tag className="h-4 w-4" />
              Add Brand
            </Link>
            <Link href="/brands?filter=review_due" className="inline-flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors">
              <AlertTriangle className="h-4 w-4" />
              Review Overdue Brands
            </Link>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(recentActivity || []).length === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-400">No activity yet</p>
            ) : (
              (recentActivity as { action_type: string; entity_name: string | null; created_at: string; profiles: { full_name: string | null; email: string } | null }[]).map((a, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-900">
                    <span className="font-medium">{a.profiles?.full_name || a.profiles?.email}</span>
                    {' — '}{a.action_type.replace(/_/g, ' ')}
                    {a.entity_name && <span className="text-gray-500"> ({a.entity_name})</span>}
                  </span>
                  <span className="text-gray-400 text-xs">{new Date(a.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
