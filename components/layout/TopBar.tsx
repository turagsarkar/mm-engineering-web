'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { Shield, User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const { user, isAdmin } = useUser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut().catch(() => {})
    router.push('/login')
  }

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
      <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>

      <div className="relative flex items-center gap-2 shrink-0 ml-2" ref={ref}>
        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        )}

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {displayName[0].toUpperCase()}
          </div>
          <span className="hidden sm:inline font-medium truncate max-w-28">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              <p className="text-xs font-medium text-blue-600 capitalize mt-0.5">{user?.role}</p>
            </div>
            {isAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                Manage Users
              </Link>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
