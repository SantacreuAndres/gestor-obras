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

        // Si no hay sesión, usar un usuario fijo compartido
        if (!data.session) {
          const { data: userData, error } = await supabase.auth.signInWithPassword({
            email: 'user@gestor-obras.local',
            password: 'gestor-obras-2024'
          })

          // Si el usuario no existe, intentar crearlo
          if (error?.message?.includes('Invalid login credentials')) {
            const { data: signupData, error: signupError } = await supabase.auth.signUp({
              email: 'user@gestor-obras.local',
              password: 'gestor-obras-2024'
            })
            if (signupError) throw signupError
            setSession(signupData.session)
          } else if (error) {
            throw error
          } else {
            setSession(userData.session)
          }
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
