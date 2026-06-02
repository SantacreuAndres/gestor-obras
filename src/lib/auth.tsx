import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

const ALLOWED_EMAIL = 'santacreu.andres@gmail.com'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
})

function isAllowed(session: Session | null): boolean {
  return session?.user?.email?.toLowerCase() === ALLOWED_EMAIL
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (isAllowed(data.session)) {
        setSession(data.session)
      } else if (data.session) {
        supabase.auth.signOut()
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isAllowed(newSession)) {
        setSession(newSession)
      } else {
        setSession(null)
        if (newSession) supabase.auth.signOut()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthCtx.Provider
      value={{ session, user: session?.user ?? null, loading }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth(): AuthState {
  return useContext(AuthCtx)
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
