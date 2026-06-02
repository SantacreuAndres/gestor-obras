import { useEffect, useRef, useState } from 'react'
import {
  Download,
  Upload,
  AlertTriangle,
  Database,
  Info,
  Trash2,
  LogOut,
  Calendar,
  RefreshCw,
  Link2,
  Link2Off,
} from 'lucide-react'
import { obras as obrasApi } from '../db/db'
import { useLive } from '../hooks/useLive'
import {
  downloadBackup,
  exportAll,
  importAll,
  wipeAll,
  type ImportMode,
  type ImportSummary,
} from '../lib/backup'
import { useAuth, signOut } from '../lib/auth'
import {
  disconnect as googleDisconnect,
  getStatus as googleGetStatus,
  startConnect as googleStartConnect,
  syncNow as googleSyncNow,
  type GoogleStatus,
  type SyncResult,
} from '../lib/googleSync'

export function Configuracion() {
  const cantObras = useLive('obras', () => obrasApi.count(), []) ?? 0
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    parsed: unknown
    name: string
  } | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleMsg, setGoogleMsg] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null)

  useEffect(() => {
    googleGetStatus()
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ connected: false, connected_at: null, last_sync_at: null, last_sync_error: null, calendar_id: null }))
    // Read ?google=... from hash query (HashRouter style: /#/config?google=connected)
    const hash = window.location.hash
    const idx = hash.indexOf('?')
    if (idx >= 0) {
      const params = new URLSearchParams(hash.slice(idx + 1))
      const status = params.get('google')
      if (status) {
        if (status === 'connected') {
          setGoogleMsg({ kind: 'ok', text: 'Cuenta de Google conectada.' })
          // Trigger a first sync automatically
          googleSyncNow()
            .then(() => googleGetStatus().then(setGoogleStatus))
            .catch(() => {})
        } else {
          setGoogleMsg({ kind: 'err', text: `No pude conectar Google: ${status}` })
        }
        // Clean the URL
        window.history.replaceState(null, '', '#/config')
      }
    }
  }, [])

  async function onGoogleConnect() {
    try {
      setGoogleBusy(true)
      setGoogleMsg(null)
      await googleStartConnect()
    } catch (e) {
      setGoogleBusy(false)
      setGoogleMsg({ kind: 'err', text: (e as Error).message })
    }
  }

  async function onGoogleDisconnect() {
    try {
      setGoogleBusy(true)
      setGoogleMsg(null)
      await googleDisconnect()
      const s = await googleGetStatus()
      setGoogleStatus(s)
      setGoogleMsg({ kind: 'ok', text: 'Cuenta de Google desconectada.' })
    } catch (e) {
      setGoogleMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setGoogleBusy(false)
    }
  }

  async function onGoogleSync() {
    try {
      setGoogleBusy(true)
      setGoogleMsg(null)
      const r: SyncResult = await googleSyncNow()
      const s = await googleGetStatus()
      setGoogleStatus(s)
      const total =
        r.pushed.created +
        r.pushed.updated +
        r.pushed.deleted +
        r.pulled.created +
        r.pulled.updated +
        r.pulled.deleted
      setGoogleMsg({
        kind: r.errors.length ? 'err' : 'ok',
        text: `Sync ok · ${total} cambios (↑${r.pushed.created}+${r.pushed.updated}-${r.pushed.deleted} ↓${r.pulled.created}+${r.pulled.updated}-${r.pulled.deleted})${r.errors.length ? ' · ' + r.errors.join('; ') : ''}`,
      })
    } catch (e) {
      setGoogleMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setGoogleBusy(false)
    }
  }

  async function onExport() {
    try {
      setBusy(true)
      setMsg(null)
      const data = await exportAll()
      downloadBackup(data)
      setMsg({
        kind: 'ok',
        text: `Backup descargado (${data.obras.length} obras, ${data.contactos.length} contactos).`,
      })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const text = await f.text()
      const parsed = JSON.parse(text)
      setPendingImport({ parsed, name: f.name })
      setMsg(null)
    } catch (err) {
      setMsg({ kind: 'err', text: 'No pude leer el JSON: ' + (err as Error).message })
    }
  }

  async function confirmImport(mode: ImportMode) {
    if (!pendingImport) return
    try {
      setBusy(true)
      setMsg(null)
      const sum: ImportSummary = await importAll(pendingImport.parsed, mode)
      const total =
        sum.obras +
        sum.notas +
        sum.deadlines +
        sum.documentos +
        sum.materiales +
        sum.fotos +
        sum.contactos +
        sum.plata +
        sum.viaticos
      setMsg({
        kind: 'ok',
        text: `Importado: ${total} registros (${
          mode === 'replace' ? 'reemplazo total' : 'merge'
        }).`,
      })
      setPendingImport(null)
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function onWipe() {
    try {
      setBusy(true)
      setMsg(null)
      await wipeAll()
      setConfirmWipe(false)
      setMsg({ kind: 'ok', text: 'Datos borrados de la nube.' })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Configuración</div>
          <div className="page-subtitle">Cuenta, backup y datos.</div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Obras</div>
          <div className="kpi-value numeric">{cantObras}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Modo</div>
          <div className="kpi-value">Nube</div>
          <div className="kpi-foot">Supabase · sincroniza Mac ↔ iPhone</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sesión</div>
          <div className="kpi-value" style={{ fontSize: '1rem', wordBreak: 'break-all' }}>
            {user?.email ?? '—'}
          </div>
          <button
            className="btn btn-ghost btn-sm mt-8"
            onClick={() => signOut()}
            style={{ alignSelf: 'flex-start' }}
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </div>

      {msg && (
        <div
          className="card mb-16"
          style={{
            background: msg.kind === 'ok' ? 'var(--c-success-soft)' : 'var(--c-danger-soft)',
            borderColor: msg.kind === 'ok' ? 'var(--c-success)' : 'var(--c-danger)',
            color: msg.kind === 'ok' ? 'var(--c-success)' : 'var(--c-danger)',
          }}
        >
          <div className="row gap-8">
            {msg.kind === 'ok' ? <Info size={16} /> : <AlertTriangle size={16} />}
            <span className="weight-600">{msg.text}</span>
          </div>
        </div>
      )}

      <div className="section-head">
        <span>Apple Calendar / Google Calendar</span>
      </div>
      <div className="card mb-16">
        <div className="row gap-8" style={{ alignItems: 'center' }}>
          <Calendar size={18} />
          <span className="weight-600">
            {googleStatus?.connected
              ? 'Conectado a Google Calendar'
              : 'No conectado'}
          </span>
        </div>
        <p className="text-sm text-soft">
          Cuando conectás Google Calendar, los eventos sincronizan en ambos
          sentidos. Para verlos en Apple Calendar: en tu iPhone andá a
          <b> Ajustes → Calendario → Cuentas → Añadir cuenta → Google</b> y
          activá Calendarios.
        </p>
        {googleStatus?.connected && (
          <p className="text-sm text-soft">
            Último sync:{' '}
            {googleStatus.last_sync_at
              ? new Date(googleStatus.last_sync_at).toLocaleString('es-AR')
              : 'nunca'}
            {googleStatus.last_sync_error && (
              <>
                {' '}
                · <span style={{ color: 'var(--c-danger)' }}>error: {googleStatus.last_sync_error}</span>
              </>
            )}
          </p>
        )}
        <div className="row gap-8 mt-8" style={{ flexWrap: 'wrap' }}>
          {!googleStatus?.connected ? (
            <button
              className="btn btn-primary"
              onClick={onGoogleConnect}
              disabled={googleBusy}
            >
              <Link2 size={16} /> Conectar Google Calendar
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={onGoogleSync}
                disabled={googleBusy}
              >
                <RefreshCw size={16} /> {googleBusy ? 'Sincronizando…' : 'Sincronizar ahora'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={onGoogleDisconnect}
                disabled={googleBusy}
              >
                <Link2Off size={16} /> Desconectar
              </button>
            </>
          )}
        </div>
        {googleMsg && (
          <div
            className="mt-8 text-sm"
            style={{
              color: googleMsg.kind === 'ok' ? 'var(--c-success)' : 'var(--c-danger)',
            }}
          >
            {googleMsg.text}
          </div>
        )}
      </div>

      <div className="section-head">
        <span>Backup / portabilidad</span>
      </div>
      <div className="card mb-16">
        <p className="text-sm text-soft">
          Los datos viven en Supabase y sincronizan solos entre tus dispositivos.
          Igual podés exportar todas las obras, contactos y registros a un JSON
          como backup extra (los archivos de Storage no se incluyen).
        </p>
        <div className="row gap-8 mt-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onExport} disabled={busy}>
            <Download size={16} /> Exportar backup
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload size={16} /> Importar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onFile}
          />
        </div>
      </div>

      {pendingImport && (
        <div className="card mb-16" style={{ borderColor: 'var(--c-warn)' }}>
          <div className="row gap-8">
            <AlertTriangle size={18} color="var(--c-warn)" />
            <span className="weight-600">
              Archivo listo para importar: {pendingImport.name}
            </span>
          </div>
          <p className="text-sm text-soft">
            Elegí cómo aplicar el backup. <b>Reemplazar</b> borra todos los datos
            actuales y los reemplaza por los del archivo. <b>Merge</b> agrega o
            actualiza por id sin borrar lo que no esté en el archivo.
          </p>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-danger"
              onClick={() => confirmImport('replace')}
              disabled={busy}
            >
              Reemplazar todo
            </button>
            <button
              className="btn btn-primary"
              onClick={() => confirmImport('merge')}
              disabled={busy}
            >
              Hacer merge
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPendingImport(null)}
              disabled={busy}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="section-head">
        <span>Zona peligrosa</span>
      </div>
      <div className="card" style={{ borderColor: 'var(--c-danger)' }}>
        <div className="row gap-8">
          <Database size={18} color="var(--c-danger)" />
          <span className="weight-600">Borrar todos los datos de la nube</span>
        </div>
        <p className="text-sm text-soft">
          Esto borra todas las obras, contactos, materiales y registros de tu
          cuenta en Supabase. Hacé un backup antes si querés conservarlos.
        </p>
        {confirmWipe ? (
          <div className="confirm-strip">
            <span className="confirm-strip-text">¿Borrar todo de la nube?</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmWipe(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="btn btn-danger btn-sm" onClick={onWipe} disabled={busy}>
              Sí, borrar todo
            </button>
          </div>
        ) : (
          <button
            className="btn btn-danger"
            onClick={() => setConfirmWipe(true)}
            disabled={busy}
            style={{ alignSelf: 'flex-start' }}
          >
            <Trash2 size={14} /> Borrar todo
          </button>
        )}
      </div>
    </div>
  )
}
