import { useState } from 'react'
import {
  Plus,
  Check,
  RotateCcw,
  Trash2,
  AlarmClock,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { useObra } from '../ObraDetail'
import { deadlines as deadlinesApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import type { Deadline } from '../../db/schema'
import { uid, todayIso } from '../../lib/ids'
import { fmtDate, diasHasta } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'

const blank = (obraId: string): Partial<Deadline> => ({
  obraId,
  titulo: '',
  fechaLimite: todayIso(),
  estado: 'pendiente',
  avisar: true,
})

export function Deadlines() {
  const obra = useObra()
  const items = useLive('deadlines', () => deadlinesApi.byObra(obra.id), [obra.id]) ?? []
  const [editing, setEditing] = useState<Partial<Deadline> | null>(null)

  async function save() {
    if (!editing?.titulo?.trim() || !editing.fechaLimite) return
    const id = editing.id ?? uid()
    await deadlinesApi.put({
      id,
      obraId: obra.id,
      titulo: editing.titulo.trim(),
      fechaLimite: editing.fechaLimite,
      descripcion: editing.descripcion?.trim() || undefined,
      estado: editing.estado ?? 'pendiente',
      avisar: editing.avisar ?? true,
    })
    setEditing(null)
  }

  async function toggle(d: Deadline) {
    await deadlinesApi.update(d.id, {
      estado: d.estado === 'pendiente' ? 'cumplido' : 'pendiente',
    })
  }

  async function borrar(id: string) {
    await deadlinesApi.delete(id)
  }

  const pendientes = items.filter((d) => d.estado === 'pendiente')
  const cumplidos = items.filter((d) => d.estado === 'cumplido')

  return (
    <>
      <div className="row-between mb-12">
        <h3>Deadlines</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setEditing(blank(obra.id))}
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {items.length === 0 && (
        <EmptyState
          icon={AlarmClock}
          title="Sin deadlines"
          subtitle="Cargá fechas críticas: entrega de planos, presentación municipal, etc."
        />
      )}

      {pendientes.length > 0 && (
        <div className="list mb-16">
          {pendientes.map((d) => (
            <DeadlineRow
              key={d.id}
              d={d}
              onEdit={() => setEditing(d)}
              onToggle={() => toggle(d)}
              onDelete={() => borrar(d.id)}
            />
          ))}
        </div>
      )}

      {cumplidos.length > 0 && (
        <>
          <div className="section-head">
            <span>Cumplidos</span>
          </div>
          <div className="list">
            {cumplidos.map((d) => (
              <DeadlineRow
                key={d.id}
                d={d}
                onEdit={() => setEditing(d)}
                onToggle={() => toggle(d)}
                onDelete={() => borrar(d.id)}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar deadline' : 'Nuevo deadline'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!editing?.titulo?.trim() || !editing?.fechaLimite}
            >
              Guardar
            </button>
          </>
        }
      >
        {editing && (
          <>
            <div className="field">
              <label className="field-label">Título *</label>
              <input
                className="input"
                autoFocus
                value={editing.titulo ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, titulo: e.target.value })
                }
                placeholder="Ej. Entregar planos a municipio"
              />
            </div>
            <div className="field">
              <label className="field-label">Fecha límite *</label>
              <input
                className="input"
                type="date"
                value={editing.fechaLimite ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, fechaLimite: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label className="field-label">Descripción</label>
              <textarea
                className="textarea"
                value={editing.descripcion ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, descripcion: e.target.value })
                }
              />
            </div>
            <label className="row gap-8">
              <input
                type="checkbox"
                checked={editing.avisar ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, avisar: e.target.checked })
                }
              />
              <span className="text-sm">Mostrar en el dashboard de avisos</span>
            </label>
          </>
        )}
      </Modal>
    </>
  )
}

function DeadlineRow({
  d,
  onEdit,
  onToggle,
  onDelete,
}: {
  d: Deadline
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const dias = diasHasta(d.fechaLimite)
  const vencido = d.estado === 'pendiente' && dias !== null && dias < 0
  const proximo = d.estado === 'pendiente' && dias !== null && dias <= 3 && dias >= 0
  const cumplido = d.estado === 'cumplido'

  return (
    <div className="list-row">
      <button
        className="btn-icon"
        onClick={onToggle}
        aria-label={cumplido ? 'Marcar como pendiente' : 'Marcar como cumplido'}
        style={{
          background: cumplido ? 'var(--c-success-soft)' : undefined,
          color: cumplido ? 'var(--c-success)' : undefined,
        }}
      >
        {cumplido ? <RotateCcw size={16} /> : <Check size={16} />}
      </button>
      <div className="list-row-main">
        <div
          className="list-row-title"
          style={{
            textDecoration: cumplido ? 'line-through' : undefined,
            color: cumplido ? 'var(--c-text-muted)' : undefined,
          }}
        >
          {d.titulo}
        </div>
        <div className="list-row-sub">
          <span className="row gap-6">
            {vencido && <AlertTriangle size={13} color="var(--c-danger)" />}
            {fmtDate(d.fechaLimite)}
            {d.estado === 'pendiente' && dias !== null && (
              <span
                className={
                  'badge ' +
                  (vencido ? 'badge-danger' : proximo ? 'badge-warn' : '')
                }
              >
                {vencido
                  ? `${Math.abs(dias)}d vencido`
                  : dias === 0
                    ? 'Hoy'
                    : `en ${dias}d`}
              </span>
            )}
          </span>
        </div>
        {d.descripcion && (
          <div className="text-sm text-soft mt-8" style={{ whiteSpace: 'pre-wrap' }}>
            {d.descripcion}
          </div>
        )}
      </div>
      <button className="btn-icon" onClick={onEdit} aria-label="Editar">
        <Pencil size={14} />
      </button>
      <button className="btn-icon" onClick={onDelete} aria-label="Borrar">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
