'use client'
import { useUser } from '@/lib/hooks/useUser'
import { Shield, User } from 'lucide-react'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const { user, isAdmin } = useUser()
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
      <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        )}
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <User className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline truncate max-w-32">{user?.full_name || user?.email}</span>
        </div>
      </div>
    </header>
  )
}
