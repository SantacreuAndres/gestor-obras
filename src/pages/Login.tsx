import { useState } from 'react'
import { HardHat, Mail, KeyRound, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Step = 'email' | 'code'

export function Login() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pedirCodigo() {
    const e = email.trim().toLowerCase()
    if (!e) return
    setBusy(true)
    setErr(null)
    try {
      // Usar URL de redirección configurada en .env, o la URL actual como fallback
      const redirectUrl =
        import.meta.env.VITE_AUTH_REDIRECT_URL || `${window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectUrl,
        },
      })
      if (error) throw error
      setStep('code')
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verificarCodigo() {
    const e = email.trim().toLowerCase()
    const c = code.trim()
    if (!e || c.length < 6) return
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: e,
        token: c,
        type: 'email',
      })
      if (error) throw error
      // onAuthStateChange en AuthProvider hace el resto
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 48 }}>
      <div className="row gap-8 mb-12" style={{ alignItems: 'center' }}>
        <span className="sidebar-brand-mark">
          <HardHat size={16} />
        </span>
        <h1 style={{ margin: 0 }}>Gestor de Obras</h1>
      </div>

      {step === 'email' && (
        <div className="card">
          <p className="text-sm text-soft">
            Ingresá tu email. Te mandamos un código de 6 dígitos para entrar.
          </p>
          <div className="field">
            <label className="field-label">Email</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
              <Mail size={16} color="var(--c-text-muted)" />
              <input
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="email"
                placeholder="vos@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') pedirCodigo()
                }}
                style={{
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  flex: 1,
                  padding: 4,
                  fontSize: '0.95rem',
                }}
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={pedirCodigo}
            disabled={busy || !email.includes('@')}
            style={{ width: '100%' }}
          >
            {busy ? 'Enviando…' : 'Mandar código'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div className="card">
          <p className="text-sm text-soft">
            Te mandamos un código a <b>{email}</b>. Revisá tu casilla
            (también spam) y pegalo abajo.
          </p>
          <div className="field">
            <label className="field-label">Código de 6 dígitos</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
              <KeyRound size={16} color="var(--c-text-muted)" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') verificarCodigo()
                }}
                style={{
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  flex: 1,
                  padding: 4,
                  fontSize: '1.2rem',
                  letterSpacing: '0.3em',
                }}
              />
            </div>
          </div>
          <div className="row gap-8" style={{ flexDirection: 'column' }}>
            <button
              className="btn btn-primary"
              onClick={verificarCodigo}
              disabled={busy || code.length < 6}
              style={{ width: '100%' }}
            >
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setStep('email')
                setCode('')
                setErr(null)
              }}
              disabled={busy}
              style={{ width: '100%' }}
            >
              Cambiar email
            </button>
          </div>
        </div>
      )}

      {err && (
        <div
          className="card mt-12"
          style={{
            background: 'var(--c-danger-soft)',
            borderColor: 'var(--c-danger)',
            color: 'var(--c-danger)',
          }}
        >
          <div className="row gap-8">
            <AlertTriangle size={16} />
            <span className="weight-600">{err}</span>
          </div>
        </div>
      )}
    </div>
  )
}
