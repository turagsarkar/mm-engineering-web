'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Tag, BarChart2, LogOut, ChevronRight, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { href: '/',                  label: 'Home',             icon: Home,     adminOnly: false },
  { href: '/brands',            label: 'Brands',           icon: Tag,      adminOnly: false },
  { href: '/price-comparisons', label: 'Price Comparisons',icon: BarChart2,adminOnly: false },
  { href: '/admin',             label: 'Admin',            icon: Shield,   adminOnly: true  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAdmin } = useUser()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-gray-800">
        <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-xs font-bold">MM</span>
        </div>
        <div>
          <p className="text-sm font-semibold">MM Engineering</p>
          <p className="text-xs text-gray-400">S.T.E.V.E Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.filter(item => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white truncate">
            {user?.full_name || user?.email}
          </p>
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
    </aside>
  )
}
