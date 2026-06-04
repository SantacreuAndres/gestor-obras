import { useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Camera,
  Check,
  RotateCcw,
} from 'lucide-react'
import { useObra } from '../ObraDetail'
import { viaticos as viaticosApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import { uploadToBucket, getSignedUrl, removeFromBucket } from '../../lib/storage'
import type { Viatico } from '../../db/schema'
import { uid, todayIso } from '../../lib/ids'
import { fmtMoney, fmtDate } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { BlobImage } from '../../components/BlobImage'

const blank = (obraId: string): Partial<Viatico> => ({
  obraId,
  fecha: todayIso(),
  concepto: '',
  monto: 0,
  estado: 'pendiente',
})

export function Viaticos() {
  const obra = useObra()
  const items = useLive('viaticos', () => viaticosApi.byObra(obra.id), [obra.id]) ?? []
  const [editing, setEditing] = useState<Partial<Viatico> | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const totales = useMemo(() => {
    const puesto = items.reduce((acc, v) => acc + v.monto, 0)
    const aCobrar = items
      .filter((v) => v.estado === 'pendiente')
      .reduce((acc, v) => acc + v.monto, 0)
    return { puesto, aCobrar, cobrado: puesto - aCobrar }
  }, [items])

  async function save() {
    if (!editing?.concepto?.trim() || !editing.fecha) return
    const id = editing.id ?? uid()
    await viaticosApi.put({
      id,
      obraId: obra.id,
      fecha: editing.fecha,
      concepto: editing.concepto.trim(),
      monto: Number(editing.monto ?? 0),
      comprobantePath: editing.comprobantePath,
      estado: editing.estado ?? 'pendiente',
    })
    setEditing(null)
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !editing) return
    try {
      setUploading(true)
      const path = await uploadToBucket('comprobantes', obra.id, f)
      setEditing({ ...editing, comprobantePath: path })
    } catch (err) {
      alert('Error subiendo el comprobante: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function quitarComprobante() {
    if (!editing?.comprobantePath) return
    await removeFromBucket('comprobantes', editing.comprobantePath)
    setEditing({ ...editing, comprobantePath: undefined })
  }

  async function toggle(v: Viatico) {
    await viaticosApi.update(v.id, {
      estado: v.estado === 'pendiente' ? 'recuperado' : 'pendiente',
    })
  }

  async function borrar(v: Viatico) {
    if (v.comprobantePath) await removeFromBucket('comprobantes', v.comprobantePath)
    await viaticosApi.delete(v.id)
  }

  async function abrirPreview(path: string | undefined) {
    if (!path) return
    const u = await getSignedUrl('comprobantes', path)
    if (u) setPreview(u)
  }

  return (
    <>
      <div className="row-between mb-12">
        <h3>Viáticos / Gastos a recuperar</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setEditing(blank(obra.id))}
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Total puesto</div>
          <div className="kpi-value numeric">{fmtMoney(totales.puesto)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">A cobrar</div>
          <div className="kpi-value numeric" style={{ color: totales.aCobrar > 0 ? 'var(--c-warn)' : 'var(--c-success)' }}>
            {fmtMoney(totales.aCobrar)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cobrado</div>
          <div className="kpi-value numeric text-success">
            {fmtMoney(totales.cobrado)}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin viáticos cargados"
          subtitle="Anotá nafta, peajes, fletes, comida… cualquier gasto que ponés y después cobrás."
        />
      ) : (
        <div className="list">
          {items.map((v) => (
            <div key={v.id} className="card">
              <div className="row-between gap-8">
                <div className="col" style={{ minWidth: 0 }}>
                  <div className="weight-600 truncate">{v.concepto}</div>
                  <div className="text-xs text-muted">{fmtDate(v.fecha)}</div>
                </div>
                <div className="numeric weight-700">{fmtMoney(v.monto)}</div>
                <button
                  className="btn-icon"
                  onClick={() => toggle(v)}
                  aria-label={v.estado === 'pendiente' ? 'Marcar cobrado' : 'Marcar pendiente'}
                  style={{
                    background: v.estado === 'recuperado' ? 'var(--c-success-soft)' : 'var(--c-warn-soft)',
                    color: v.estado === 'recuperado' ? 'var(--c-success)' : 'var(--c-warn)',
                  }}
                >
                  {v.estado === 'recuperado' ? <RotateCcw size={15} /> : <Check size={15} />}
                </button>
                <button className="btn-icon" onClick={() => setEditing(v)} aria-label="Editar">
                  <Pencil size={14} />
                </button>
                <button className="btn-icon" onClick={() => borrar(v)} aria-label="Borrar">
                  <Trash2 size={14} />
                </button>
              </div>
              {v.comprobantePath && (
                <div className="mt-8">
                  <BlobImage
                    bucket="comprobantes"
                    path={v.comprobantePath}
                    alt="Comprobante"
                    onClick={() => abrirPreview(v.comprobantePath)}
                    style={{
                      maxHeight: 140,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'zoom-in',
                      border: '1px solid var(--c-border)',
                    }}
                  />
                </div>
              )}
              <div className="row gap-8">
                <span
                  className={
                    'badge ' +
                    (v.estado === 'recuperado' ? 'badge-success' : 'badge-warn')
                  }
                >
                  {v.estado === 'recuperado' ? 'Recuperado' : 'Pendiente de recuperar'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="modal-backdrop"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="Comprobante"
            style={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              borderRadius: 'var(--radius-md)',
            }}
          />
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar viático' : 'Nuevo viático'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!editing?.concepto?.trim() || !editing?.fecha}
            >
              Guardar
            </button>
          </>
        }
      >
        {editing && (
          <>
            <div className="row gap-8">
              <div className="field flex-1">
                <label className="field-label">Fecha *</label>
                <input
                  className="input"
                  type="date"
                  value={editing.fecha ?? ''}
                  onChange={(e) => setEditing({ ...editing, fecha: e.target.value })}
                />
              </div>
              <div className="field flex-1">
                <label className="field-label">Monto *</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={editing.monto ?? 0}
                  onChange={(e) => setEditing({ ...editing, monto: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Concepto *</label>
              <input
                className="input"
                value={editing.concepto ?? ''}
                onChange={(e) => setEditing({ ...editing, concepto: e.target.value })}
                placeholder="Ej. Nafta viaje a la obra, flete arena…"
              />
            </div>
            <div className="field">
              <label className="field-label">Estado</label>
              <select
                className="select"
                value={editing.estado ?? 'pendiente'}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    estado: e.target.value as 'pendiente' | 'recuperado',
                  })
                }
              >
                <option value="pendiente">Pendiente de recuperar</option>
                <option value="recuperado">Recuperado</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Comprobante (foto del ticket)</label>
              {editing.comprobantePath ? (
                <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                  <BlobImage
                    bucket="comprobantes"
                    path={editing.comprobantePath}
                    style={{
                      maxHeight: 90,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--c-border)',
                    }}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={quitarComprobante}>
                    Quitar
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={() => fileRef.current?.click()}
                  type="button"
                  disabled={uploading}
                >
                  <Camera size={14} /> {uploading ? 'Subiendo…' : 'Sacar / elegir foto'}
                </button>
              )}
              {/* No 'capture' attribute on purpose: iOS Safari opens its native
                  sheet with "Tomar foto", "Elegir foto" (galería) y "Elegir
                  archivo". Forcing capture="environment" would skip the
                  picker and open the camera directly. */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onPickFile}
              />
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
