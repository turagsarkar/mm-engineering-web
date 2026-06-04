'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Tag, BarChart2, LogOut, ChevronRight, Shield, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { href: '/',                  label: 'Home',             icon: Home,      adminOnly: false },
  { href: '/brands',            label: 'Brands',           icon: Tag,       adminOnly: false },
  { href: '/price-comparisons', label: 'Price Comparisons',icon: BarChart2, adminOnly: false },
  { href: '/admin',             label: 'Admin',            icon: Shield,    adminOnly: true  },
]

function NavItems({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAdmin } = useUser()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut().catch(() => {})
    router.push('/login')
  }

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-6 border-b border-gray-800">
        <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-xs font-bold text-white">MM</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">MM Engineering</p>
          <p className="text-xs text-gray-400">S.T.E.V.E Portal</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.filter(item => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email}</p>
          <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 flex items-center px-4 h-14 border-b border-gray-800">
        <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white mr-3">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-xs font-bold text-white">MM</span>
          </div>
          <span className="text-sm font-semibold text-white">MM Engineering</span>
        </div>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        'lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 flex flex-col transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <NavItems onClose={() => setMobileOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-gray-900 text-white shrink-0">
        <NavItems />
      </aside>
    </>
  )
}
