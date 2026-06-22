import { useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Camera,
  CheckSquare,
  Square,
  FileDown,
  Share,
  X,
} from 'lucide-react'
import { useObra } from '../ObraDetail'
import { gastos as gastosApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import {
  uploadToBucket,
  getSignedUrl,
  removeFromBucket,
  getDataUrl,
} from '../../lib/storage'
import type { Gasto } from '../../db/schema'
import { uid, todayIso } from '../../lib/ids'
import { fmtMoney, fmtDate } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { BlobImage } from '../../components/BlobImage'
import { exportarPdf } from '../../lib/exportPdf'

const blank = (obraId: string): Partial<Gasto> => ({
  obraId,
  fecha: todayIso(),
  concepto: '',
  monto: 0,
})

export function Gastos() {
  const obra = useObra()
  const items = useLive('gastos', () => gastosApi.byObra(obra.id), [obra.id]) ?? []
  const [editing, setEditing] = useState<Partial<Gasto> | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const total = useMemo(
    () => items.reduce((acc, g) => acc + g.monto, 0),
    [items],
  )

  const selectedTotal = useMemo(
    () =>
      items
        .filter((g) => selected.has(g.id))
        .reduce((acc, g) => acc + g.monto, 0),
    [items, selected],
  )

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(items.map((g) => g.id)))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function save() {
    if (!editing?.concepto?.trim() || !editing.fecha) return
    const id = editing.id ?? uid()
    await gastosApi.put({
      id,
      obraId: obra.id,
      fecha: editing.fecha,
      concepto: editing.concepto.trim(),
      monto: Number(editing.monto ?? 0),
      comprobantePath: editing.comprobantePath,
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

  async function borrar(g: Gasto) {
    if (g.comprobantePath) await removeFromBucket('comprobantes', g.comprobantePath)
    await gastosApi.delete(g.id)
  }

  async function abrirPreview(path: string | undefined) {
    if (!path) return
    const u = await getSignedUrl('comprobantes', path)
    if (u) setPreview(u)
  }

  async function exportarSeleccionados() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const seleccionados = items
      .filter((g) => selected.has(g.id))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    try {
      setExporting(true)
      const itemsConFotos = await Promise.all(
        seleccionados.map(async (g) => ({
          fecha: g.fecha,
          concepto: g.concepto,
          monto: g.monto,
          comprobanteDataUrl: g.comprobantePath
            ? (await getDataUrl('comprobantes', g.comprobantePath)) ?? undefined
            : undefined,
        })),
      )
      await exportarPdf({
        titulo: 'Gastos',
        obra: obra.nombre,
        items: itemsConFotos,
      })
      await gastosApi.markExported(ids)
      exitSelectMode()
    } catch (err) {
      alert('No se pudo exportar el PDF: ' + (err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="row-between mb-12">
        <h3>Gastos</h3>
        {selectMode ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={exitSelectMode}
            aria-label="Salir del modo selección"
          >
            <X size={14} /> Cancelar
          </button>
        ) : (
          <div className="row gap-8">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectMode(true)}
              disabled={items.length === 0}
            >
              <Share size={14} /> Exportar
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditing(blank(obra.id))}
            >
              <Plus size={14} /> Nuevo
            </button>
          </div>
        )}
      </div>

      {selectMode && (
        <div
          className="row-between gap-8 mb-12"
          style={{
            background: 'rgba(255, 255, 255, 0.32)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        >
          <div className="col">
            <div className="text-xs text-muted">
              {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
            </div>
            <div className="weight-700 numeric">{fmtMoney(selectedTotal)}</div>
          </div>
          <div className="row gap-8">
            <button
              className="btn btn-ghost btn-sm"
              onClick={selectAll}
              disabled={items.length === 0 || selected.size === items.length}
            >
              Todos
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={exportarSeleccionados}
              disabled={selected.size === 0 || exporting}
            >
              <FileDown size={14} /> {exporting ? 'Generando…' : 'Exportar'}
            </button>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Total gastos</div>
          <div className="kpi-value numeric">{fmtMoney(total)}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin gastos cargados"
          subtitle="Gastos propios (que no se cobran al comitente). Los podés seleccionar y exportar a PDF cuando los necesites."
        />
      ) : (
        <div className="list">
          {items.map((g) => {
            const isSelected = selected.has(g.id)
            const wasExported = !!g.exportadoEn
            return (
              <div
                key={g.id}
                className="card"
                onClick={selectMode ? () => toggleSelect(g.id) : undefined}
                style={{
                  cursor: selectMode ? 'pointer' : undefined,
                  opacity: wasExported && !isSelected ? 0.55 : 1,
                  filter:
                    wasExported && !isSelected ? 'grayscale(0.7)' : undefined,
                  outline: isSelected
                    ? '2px solid var(--c-accent)'
                    : undefined,
                  transition:
                    'opacity 0.15s, filter 0.15s, outline-color 0.15s',
                }}
              >
                <div className="row-between gap-8">
                  {selectMode && (
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(g.id)
                      }}
                      aria-label={
                        isSelected ? 'Deseleccionar' : 'Seleccionar'
                      }
                      style={{
                        color: isSelected
                          ? 'var(--c-accent)'
                          : 'var(--c-text-soft)',
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  )}
                  <div className="col" style={{ minWidth: 0, flex: 1 }}>
                    <div className="weight-600 truncate">{g.concepto}</div>
                    <div className="text-xs text-muted">
                      {fmtDate(g.fecha)}
                      {wasExported && (
                        <span style={{ marginLeft: 6 }}>· exportado</span>
                      )}
                    </div>
                  </div>
                  <div className="numeric weight-700">{fmtMoney(g.monto)}</div>
                  {!selectMode && (
                    <>
                      <button className="btn-icon" onClick={() => setEditing(g)} aria-label="Editar">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => borrar(g)} aria-label="Borrar">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                {g.comprobantePath && (
                  <div className="mt-8">
                    <BlobImage
                      bucket="comprobantes"
                      path={g.comprobantePath}
                      alt="Comprobante"
                      onClick={
                        selectMode
                          ? undefined
                          : () => abrirPreview(g.comprobantePath)
                      }
                      style={{
                        maxHeight: 140,
                        borderRadius: 'var(--radius-md)',
                        cursor: selectMode ? 'pointer' : 'zoom-in',
                        border: '1px solid var(--c-border)',
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
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
        title={editing?.id ? 'Editar gasto' : 'Nuevo gasto'}
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
                placeholder="Ej. Herramienta, materiales propios…"
              />
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
