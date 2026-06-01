import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function AuthCallback() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    // Supabase con detectSessionInUrl debería detectar el token automáticamente
    // Redirigir si el usuario ya está autenticado
    if (!loading && user) {
      navigate('/obras', { replace: true })
    }
  }, [user, loading, navigate])

  return (
    <div className="page text-soft" style={{ padding: 48, textAlign: 'center' }}>
      Completando inicio de sesión…
    </div>
  )
}
