import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  StickyNote,
  Camera,
  Mic,
  Square,
  Share2,
  X as XIcon,
  AudioLines,
} from 'lucide-react'
import { useObra } from '../ObraDetail'
import { notas as notasApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import { uid, nowIso } from '../../lib/ids'
import { fmtDateLong } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'
import { BlobImage } from '../../components/BlobImage'
import { PhotoViewer } from '../../components/PhotoViewer'
import {
  uploadToBucket,
  getSignedUrl,
  removeFromBucket,
} from '../../lib/storage'
import type { Nota, NotaAdjunto } from '../../db/schema'

interface DraftAdjunto extends NotaAdjunto {
  blob?: Blob
  uploading?: boolean
}

export function Notas() {
  const obra = useObra()
  const notas = useLive('notas', () => notasApi.byObra(obra.id), [obra.id]) ?? []

  const [draft, setDraft] = useState('')
  const [draftAdjuntos, setDraftAdjuntos] = useState<DraftAdjunto[]>([])
  const [saving, setSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // ---------- Crear nota ----------
  async function agregar() {
    const t = draft.trim()
    if (!t && draftAdjuntos.length === 0) return
    setSaving(true)
    try {
      // Upload any pending blobs first (foto + audio recién grabados).
      // Each draftAdjunto either has a final 'path' or a 'blob' that needs upload.
      const uploaded: NotaAdjunto[] = []
      for (const a of draftAdjuntos) {
        if (a.path) {
          uploaded.push({
            id: a.id,
            tipo: a.tipo,
            path: a.path,
            mime: a.mime,
            duracion: a.duracion,
          })
        } else if (a.blob) {
          const path = await uploadToBucket(
            'notas',
            obra.id,
            new File([a.blob], filenameFor(a), { type: a.mime ?? a.blob.type }),
          )
          uploaded.push({
            id: a.id,
            tipo: a.tipo,
            path,
            mime: a.mime ?? a.blob.type,
            duracion: a.duracion,
          })
        }
      }
      await notasApi.add({
        id: uid(),
        obraId: obra.id,
        fecha: nowIso(),
        texto: t,
        anclada: false,
        adjuntos: uploaded,
      })
      setDraft('')
      setDraftAdjuntos([])
    } catch (e) {
      alert(`No pude guardar la nota:\n\n${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  // ---------- Adjuntos del draft ----------
  function quitarDraftAdjunto(id: string) {
    setDraftAdjuntos((prev) => prev.filter((a) => a.id !== id))
  }

  async function onPickFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // No subimos todavía: se sube cuando se guarda la nota. Mientras tanto
    // mostramos el preview desde el blob en memoria.
    setDraftAdjuntos((prev) => [
      ...prev,
      { id: uid(), tipo: 'foto', path: '', mime: f.type, blob: f },
    ])
  }

  // ---------- Otras acciones de notas ----------
  async function toggleAncla(id: string, ancladaActual: boolean) {
    await notasApi.update(id, { anclada: !ancladaActual })
  }

  async function borrar(n: Nota) {
    if (!window.confirm('¿Borrar esta nota y sus adjuntos?')) return
    // Borrar adjuntos del bucket primero (best-effort).
    for (const a of n.adjuntos ?? []) {
      await removeFromBucket('notas', a.path).catch(() => {})
    }
    await notasApi.delete(n.id)
  }

  const ancladas = notas.filter((n) => n.anclada)
  const otras = notas.filter((n) => !n.anclada)

  return (
    <>
      <div className="card mb-16">
        <textarea
          className="textarea"
          placeholder="Escribir una nota… (Cmd+Enter para guardar)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') agregar()
          }}
        />

        {draftAdjuntos.length > 0 && (
          <div
            className="row gap-8 mt-8"
            style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}
          >
            {draftAdjuntos.map((a) => (
              <DraftAdjuntoChip
                key={a.id}
                a={a}
                onRemove={() => quitarDraftAdjunto(a.id)}
              />
            ))}
          </div>
        )}

        <div className="row-between mt-8" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => photoInputRef.current?.click()}
              disabled={saving}
            >
              <Camera size={14} /> Foto
            </button>
            <AudioRecorderButton
              disabled={saving}
              onRecorded={(blob, mime, duracion) =>
                setDraftAdjuntos((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    tipo: 'audio',
                    path: '',
                    mime,
                    blob,
                    duracion,
                  },
                ])
              }
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onPickFoto}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={agregar}
            disabled={
              saving || (!draft.trim() && draftAdjuntos.length === 0)
            }
          >
            <Plus size={14} /> {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
        <div className="text-xs text-muted mt-4">
          Fotos y audios se adjuntan a la nota. Después podés compartirla por
          WhatsApp, Mail, Claude…
        </div>
      </div>

      {notas.length === 0 && (
        <EmptyState
          icon={StickyNote}
          title="Sin notas todavía"
          subtitle="Anotá decisiones, llamados, recordatorios… cualquier cosa de la obra."
        />
      )}

      {ancladas.length > 0 && (
        <>
          <div className="section-head">
            <span>Ancladas</span>
          </div>
          <div className="list mb-16">
            {ancladas.map((n) => (
              <NotaItem
                key={n.id}
                n={n}
                onToggleAncla={() => toggleAncla(n.id, true)}
                onBorrar={() => borrar(n)}
              />
            ))}
          </div>
        </>
      )}

      {otras.length > 0 && (
        <>
          {ancladas.length > 0 && (
            <div className="section-head">
              <span>Historial</span>
            </div>
          )}
          <div className="list">
            {otras.map((n) => (
              <NotaItem
                key={n.id}
                n={n}
                onToggleAncla={() => toggleAncla(n.id, false)}
                onBorrar={() => borrar(n)}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ============================================================
// Chip de adjunto pendiente (antes de guardar la nota)
// ============================================================
function DraftAdjuntoChip({
  a,
  onRemove,
}: {
  a: DraftAdjunto
  onRemove: () => void
}) {
  if (a.tipo === 'foto') {
    const url = a.blob ? URL.createObjectURL(a.blob) : null
    return (
      <div
        style={{
          position: 'relative',
          width: 80,
          height: 80,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid var(--c-border)',
        }}
      >
        {url && (
          <img
            src={url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar"
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            border: 0,
          }}
        >
          <XIcon size={12} />
        </button>
      </div>
    )
  }
  return (
    <div
      className="row gap-8"
      style={{
        padding: '6px 10px',
        background: 'var(--c-bg-soft)',
        border: '1px solid var(--c-border)',
        borderRadius: 999,
      }}
    >
      <AudioLines size={14} />
      <span className="text-sm">
        Audio {a.duracion ? `(${formatSeconds(a.duracion)})` : ''}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar"
        className="btn-icon"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}

// ============================================================
// Botón grabador (mic). Toggle entre Mic y Stop.
// ============================================================
function AudioRecorderButton({
  disabled,
  onRecorded,
}: {
  disabled?: boolean
  onRecorded: (blob: Blob, mime: string, duracion: number) => void
}) {
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTsRef = useRef<number>(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTsRef.current) / 1000))
    }, 250)
    return () => clearInterval(t)
  }, [recording])

  async function start() {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // Prefer audio/mp4 (Safari iOS); fall back to anything supported.
      const mime = pickMimeType()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const finalMime = rec.mimeType || mime || 'audio/mp4'
        const blob = new Blob(chunksRef.current, { type: finalMime })
        const dur = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000))
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recRef.current = null
        onRecorded(blob, finalMime, dur)
      }
      startTsRef.current = Date.now()
      setSeconds(0)
      rec.start()
      setRecording(true)
    } catch (e) {
      alert(
        `No pude acceder al micrófono:\n\n${(e as Error).message}\n\nRevisá que Safari tenga permiso en Ajustes → Safari → Micrófono.`,
      )
    }
  }

  function stop() {
    recRef.current?.stop()
    setRecording(false)
  }

  if (recording) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={stop}
        style={{
          background: 'var(--c-danger-soft)',
          color: 'var(--c-danger)',
          borderColor: 'var(--c-danger)',
        }}
      >
        <Square size={14} fill="currentColor" /> Parar ({formatSeconds(seconds)})
      </button>
    )
  }
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={start}
      disabled={disabled}
    >
      <Mic size={14} /> Audio
    </button>
  )
}

// ============================================================
// Una nota guardada con adjuntos + botón compartir
// ============================================================
function NotaItem({
  n,
  onToggleAncla,
  onBorrar,
}: {
  n: Nota
  onToggleAncla: () => void
  onBorrar: () => void
}) {
  const adjuntos = n.adjuntos ?? []
  const [viewerPath, setViewerPath] = useState<string | null>(null)

  async function compartir() {
    try {
      const files: File[] = []
      for (const a of adjuntos) {
        const url = await getSignedUrl('notas', a.path, 60)
        if (!url) continue
        const resp = await fetch(url)
        const blob = await resp.blob()
        files.push(
          new File([blob], filenameFor(a), {
            type: a.mime ?? blob.type ?? 'application/octet-stream',
          }),
        )
      }
      const text = `${fmtDateLong(n.fecha)}\n\n${n.texto}`.trim()
      const payload: ShareData = { text }
      if (files.length > 0) payload.files = files

      const canFiles =
        typeof navigator.canShare === 'function' &&
        files.length > 0 &&
        navigator.canShare({ files })

      if (typeof navigator.share === 'function' && (canFiles || files.length === 0)) {
        await navigator.share(payload)
      } else {
        // Fallback: copiar texto y avisar.
        await navigator.clipboard?.writeText(text)
        alert(
          'No puedo abrir el menú de compartir en este navegador. Copié el texto al portapapeles.',
        )
      }
    } catch (e) {
      // El user puede cancelar el sheet — eso lanza AbortError y no es error real.
      if ((e as Error).name === 'AbortError') return
      alert(`No pude compartir:\n\n${(e as Error).message}`)
    }
  }

  return (
    <div className="card">
      <div className="row-between gap-8">
        <span className="text-xs text-muted">{fmtDateLong(n.fecha)}</span>
        <div className="row gap-4">
          <button
            className="btn-icon"
            onClick={compartir}
            aria-label="Compartir"
            title="Compartir"
          >
            <Share2 size={15} />
          </button>
          <button
            className="btn-icon"
            onClick={onToggleAncla}
            aria-label={n.anclada ? 'Desanclar' : 'Anclar'}
            style={{ color: n.anclada ? 'var(--c-accent)' : undefined }}
          >
            {n.anclada ? <Pin size={15} /> : <PinOff size={15} />}
          </button>
          <button className="btn-icon" onClick={onBorrar} aria-label="Borrar">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {n.texto && (
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{n.texto}</div>
      )}
      {adjuntos.length > 0 && (
        <div
          className="row gap-8 mt-8"
          style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}
        >
          {adjuntos.map((a) =>
            a.tipo === 'foto' ? (
              <BlobImage
                key={a.id}
                bucket="notas"
                path={a.path}
                alt=""
                onClick={() => setViewerPath(a.path)}
                style={{
                  width: 96,
                  height: 96,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: '1px solid var(--c-border)',
                  cursor: 'pointer',
                }}
              />
            ) : (
              <AudioAttachment key={a.id} adjunto={a} />
            ),
          )}
        </div>
      )}
      <PhotoViewer
        bucket="notas"
        path={viewerPath}
        onClose={() => setViewerPath(null)}
      />
    </div>
  )
}

function AudioAttachment({ adjunto }: { adjunto: NotaAdjunto }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getSignedUrl('notas', adjunto.path, 3600).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [adjunto.path])
  return (
    <div
      className="row gap-8"
      style={{
        padding: '8px 12px',
        background: 'var(--c-bg-soft)',
        border: '1px solid var(--c-border)',
        borderRadius: 8,
        flex: '1 1 240px',
        minWidth: 240,
      }}
    >
      <AudioLines size={16} color="var(--c-text-muted)" />
      {url ? (
        <audio
          controls
          preload="none"
          src={url}
          style={{ flex: 1, minWidth: 0, height: 32 }}
        />
      ) : (
        <span className="text-sm text-muted">Cargando…</span>
      )}
      {adjunto.duracion && (
        <span className="text-xs text-muted">
          {formatSeconds(adjunto.duracion)}
        </span>
      )}
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================
function filenameFor(a: { tipo: 'foto' | 'audio'; mime?: string }): string {
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  }
  const ext = a.mime ? extMap[a.mime] ?? a.mime.split('/')[1] ?? 'bin' : 'bin'
  const prefix = a.tipo === 'foto' ? 'foto' : 'audio'
  return `${prefix}-${Date.now()}.${ext}`
}

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg',
  ]
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported?.(c)
    ) {
      return c
    }
  }
  return undefined
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(1, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}
