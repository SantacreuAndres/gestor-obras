import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()

        // Si no hay sesión, crear una anónima automáticamente
        if (!data.session) {
          const { data: anonData, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          setSession(anonData.session)
        } else {
          setSession(data.session)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
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
