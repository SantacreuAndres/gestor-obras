import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { obras } from '../db/db'
import type { Obra, TipoObra, EtapaObra, EstadoObra } from '../db/schema'
import { uid, nowIso } from '../lib/ids'
import {
  ETAPA_LABEL,
  TIPO_OBRA_LABEL,
  ESTADO_OBRA_LABEL,
} from '../lib/format'

type Props = {
  open: boolean
  onClose: () => void
  obraId?: string
  onSaved?: (id: string) => void
}

const blank = (): Partial<Obra> => ({
  nombre: '',
  comitente: '',
  direccion: '',
  tipo: 'nueva',
  etapa: 'anteproyecto',
  estado: 'activa',
})

export function ObraFormModal({ open, onClose, obraId, onSaved }: Props) {
  const [data, setData] = useState<Partial<Obra>>(blank())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (obraId) {
      obras.get(obraId).then((o) => o && setData(o))
    } else {
      setData(blank())
    }
  }, [open, obraId])

  async function save() {
    if (!data.nombre?.trim()) return
    setSaving(true)
    const now = nowIso()
    const id = data.id ?? uid()
    const final: Obra = {
      id,
      nombre: data.nombre!.trim(),
      comitente: (data.comitente ?? '').trim(),
      direccion: (data.direccion ?? '').trim(),
      tipo: (data.tipo ?? 'nueva') as TipoObra,
      etapa: (data.etapa ?? 'anteproyecto') as EtapaObra,
      estado: (data.estado ?? 'activa') as EstadoObra,
      superficie: data.superficie ? Number(data.superficie) : undefined,
      fechaInicio: data.fechaInicio || undefined,
      fechaEntregaEstimada: data.fechaEntregaEstimada || undefined,
      notas: data.notas?.trim() || undefined,
      createdAt: data.createdAt ?? now,
      updatedAt: now,
    }
    try {
      await obras.put(final)
      onSaved?.(id)
      onClose()
    } catch (e) {
      alert('Error al guardar: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof Obra, v: unknown) => setData((d) => ({ ...d, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={obraId ? 'Editar obra' : 'Nueva obra'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!data.nombre?.trim() || saving}
          >
            {obraId ? 'Guardar' : 'Crear obra'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label">Nombre *</label>
        <input
          className="input"
          autoFocus
          value={data.nombre ?? ''}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="Ej. Casa Pérez, Estudio Belgrano…"
        />
      </div>

      <div className="row gap-8">
        <div className="field flex-1">
          <label className="field-label">Comitente / Cliente</label>
          <input
            className="input"
            value={data.comitente ?? ''}
            onChange={(e) => set('comitente', e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Dirección / Ubicación</label>
        <input
          className="input"
          value={data.direccion ?? ''}
          onChange={(e) => set('direccion', e.target.value)}
        />
      </div>

      <div className="row gap-8">
        <div className="field flex-1">
          <label className="field-label">Tipo</label>
          <select
            className="select"
            value={data.tipo ?? 'nueva'}
            onChange={(e) => set('tipo', e.target.value as TipoObra)}
          >
            {Object.entries(TIPO_OBRA_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field flex-1">
          <label className="field-label">Superficie (m²)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={data.superficie ?? ''}
            onChange={(e) =>
              set('superficie', e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>
      </div>

      <div className="row gap-8">
        <div className="field flex-1">
          <label className="field-label">Etapa</label>
          <select
            className="select"
            value={data.etapa ?? 'anteproyecto'}
            onChange={(e) => set('etapa', e.target.value as EtapaObra)}
          >
            {Object.entries(ETAPA_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field flex-1">
          <label className="field-label">Estado</label>
          <select
            className="select"
            value={data.estado ?? 'activa'}
            onChange={(e) => set('estado', e.target.value as EstadoObra)}
          >
            {Object.entries(ESTADO_OBRA_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row gap-8">
        <div className="field flex-1">
          <label className="field-label">Inicio</label>
          <input
            className="input"
            type="date"
            value={data.fechaInicio ?? ''}
            onChange={(e) => set('fechaInicio', e.target.value)}
          />
        </div>
        <div className="field flex-1">
          <label className="field-label">Entrega estimada</label>
          <input
            className="input"
            type="date"
            value={data.fechaEntregaEstimada ?? ''}
            onChange={(e) => set('fechaEntregaEstimada', e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Notas generales</label>
        <textarea
          className="textarea"
          value={data.notas ?? ''}
          onChange={(e) => set('notas', e.target.value)}
        />
      </div>
    </Modal>
  )
}
