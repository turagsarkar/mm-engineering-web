'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppUser } from '@/lib/types/app'

interface UserContextValue {
  user: AppUser | null
  loading: boolean
  isAdmin: boolean
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true, isAdmin: false })

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', authUser.id)
        .single()

      setUser({
        id: authUser.id,
        email: authUser.email!,
        role: (profile?.role as 'admin' | 'member') ?? 'member',
        full_name: profile?.full_name ?? null,
      })
      setLoading(false)
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { load() })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
