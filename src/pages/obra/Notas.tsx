import { useState } from 'react'
import { Plus, Pin, PinOff, Trash2, StickyNote } from 'lucide-react'
import { useObra } from '../ObraDetail'
import { notas as notasApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import { uid, nowIso } from '../../lib/ids'
import { fmtDateLong } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'

export function Notas() {
  const obra = useObra()
  const notas = useLive('notas', () => notasApi.byObra(obra.id), [obra.id]) ?? []

  const [draft, setDraft] = useState('')

  async function agregar() {
    const t = draft.trim()
    if (!t) return
    await notasApi.add({
      id: uid(),
      obraId: obra.id,
      fecha: nowIso(),
      texto: t,
      anclada: false,
    })
    setDraft('')
  }

  async function toggleAncla(id: string, ancladaActual: boolean) {
    await notasApi.update(id, { anclada: !ancladaActual })
  }

  async function borrar(id: string) {
    await notasApi.delete(id)
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
        <div className="row-between">
          <span className="text-xs text-muted">
            La fecha y hora se completan solas.
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={agregar}
            disabled={!draft.trim()}
          >
            <Plus size={14} /> Agregar
          </button>
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
                texto={n.texto}
                fecha={n.fecha}
                anclada={true}
                onToggleAncla={() => toggleAncla(n.id, true)}
                onBorrar={() => borrar(n.id)}
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
                texto={n.texto}
                fecha={n.fecha}
                anclada={false}
                onToggleAncla={() => toggleAncla(n.id, false)}
                onBorrar={() => borrar(n.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function NotaItem({
  texto,
  fecha,
  anclada,
  onToggleAncla,
  onBorrar,
}: {
  texto: string
  fecha: string
  anclada: boolean
  onToggleAncla: () => void
  onBorrar: () => void
}) {
  return (
    <div className="card">
      <div className="row-between gap-8">
        <span className="text-xs text-muted">{fmtDateLong(fecha)}</span>
        <div className="row gap-4">
          <button
            className="btn-icon"
            onClick={onToggleAncla}
            aria-label={anclada ? 'Desanclar' : 'Anclar'}
            style={{ color: anclada ? 'var(--c-accent)' : undefined }}
          >
            {anclada ? <Pin size={15} /> : <PinOff size={15} />}
          </button>
          <button className="btn-icon" onClick={onBorrar} aria-label="Borrar">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{texto}</div>
    </div>
  )
}
