import { useState } from 'react'
import { HardHat, Mail, KeyRound, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function entrar(ev?: React.FormEvent) {
    ev?.preventDefault()
    const e = email.trim().toLowerCase()
    const p = password
    if (!e || !p) return
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password: p,
      })
      if (error) throw error
    } catch (e2) {
      const msg = (e2 as Error).message
      setErr(
        msg.toLowerCase().includes('invalid')
          ? 'Email o contraseña incorrectos.'
          : msg,
      )
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

      <form
        className="card"
        method="post"
        action="#"
        onSubmit={entrar}
        autoComplete="on"
      >
        <p className="text-sm text-soft">
          Acceso restringido. Ingresá tu email y contraseña.
        </p>

        <div className="field">
          <label className="field-label" htmlFor="login-email">Email</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
            <Mail size={16} color="var(--c-text-muted)" />
            <input
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="username"
              placeholder="vos@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        <div className="field">
          <label className="field-label" htmlFor="login-password">Contraseña</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
            <KeyRound size={16} color="var(--c-text-muted)" />
            <input
              id="login-password"
              name="password"
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                border: 0,
                outline: 'none',
                background: 'transparent',
                flex: 1,
                padding: 4,
                fontSize: '0.95rem',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                padding: 4,
                color: 'var(--c-text-muted)',
                display: 'flex',
              }}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !email.includes('@') || password.length < 1}
          style={{ width: '100%' }}
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

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
