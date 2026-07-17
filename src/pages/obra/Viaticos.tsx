import { useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Camera,
  Check,
  RotateCcw,
  CheckSquare,
  Square,
  FileDown,
  Share,
  X,
} from 'lucide-react'
import { useObra } from '../ObraDetail'
import { viaticos as viaticosApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import {
  uploadToBucket,
  getSignedUrl,
  removeFromBucket,
  getDataUrl,
} from '../../lib/storage'
import { runOcr } from '../../lib/ocr'
import { parseComprobante } from '../../lib/parseComprobante'
import type { Viatico } from '../../db/schema'
import { uid, todayIso } from '../../lib/ids'
import { fmtMoney, fmtDate } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { BlobImage } from '../../components/BlobImage'
import { exportarPdf } from '../../lib/exportPdf'

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
  const [reading, setReading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Selection mode: shows checkboxes and an export button.
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const totales = useMemo(() => {
    const puesto = items.reduce((acc, v) => acc + v.monto, 0)
    const aCobrar = items
      .filter((v) => v.estado === 'pendiente')
      .reduce((acc, v) => acc + v.monto, 0)
    return { puesto, aCobrar, cobrado: puesto - aCobrar }
  }, [items])

  const selectedTotal = useMemo(
    () =>
      items
        .filter((v) => selected.has(v.id))
        .reduce((acc, v) => acc + v.monto, 0),
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
    setSelected(new Set(items.map((v) => v.id)))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

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
      // Upload + OCR corren en paralelo — el OCR es lento (Tesseract carga
      // el modelo de ~10MB la primera vez) pero no bloquea el upload.
      const uploadP = uploadToBucket('comprobantes', obra.id, f)
      setReading(true)
      const ocrP = runOcr(f)
        .then((txt) => parseComprobante(txt))
        .catch((err) => {
          console.error('[ocr] error', err)
          return null
        })
      const path = await uploadP
      setUploading(false)
      // Fusionamos el path enseguida (así el usuario ve la foto en el modal).
      setEditing((prev) =>
        prev ? { ...prev, comprobantePath: path } : prev,
      )
      // Cuando el OCR termina, precargamos SOLO los campos que estén vacíos /
      // en su default — así no pisamos algo que el usuario haya tipeado
      // mientras esperaba.
      const parsed = await ocrP
      setReading(false)
      if (!parsed) return
      setEditing((prev) => {
        if (!prev) return prev
        const next = { ...prev }
        if (parsed.fecha && (!prev.fecha || prev.fecha === todayIso())) {
          next.fecha = parsed.fecha
        }
        if (parsed.monto && (!prev.monto || prev.monto === 0)) {
          next.monto = parsed.monto
        }
        if (parsed.concepto && !prev.concepto?.trim()) {
          next.concepto = parsed.referencia
            ? `${parsed.concepto} · Ref ${parsed.referencia}`
            : parsed.concepto
        }
        return next
      })
    } catch (err) {
      alert('Error subiendo el comprobante: ' + (err as Error).message)
    } finally {
      setUploading(false)
      setReading(false)
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

  async function exportarSeleccionados() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const seleccionados = items
      .filter((v) => selected.has(v.id))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    try {
      setExporting(true)
      // Descarga las imágenes de comprobante en paralelo y las pasa al PDF
      // como data URLs para embeberlas. Si alguna falla, se exporta sin ella.
      const itemsConFotos = await Promise.all(
        seleccionados.map(async (v) => ({
          fecha: v.fecha,
          concepto: v.concepto,
          monto: v.monto,
          comprobanteDataUrl: v.comprobantePath
            ? (await getDataUrl('comprobantes', v.comprobantePath)) ?? undefined
            : undefined,
        })),
      )
      await exportarPdf({
        titulo: 'Viáticos',
        obra: obra.nombre,
        comitente: obra.comitente,
        items: itemsConFotos,
      })
      // Solo marcamos como exportados después de que el PDF se generó bien.
      await viaticosApi.markExported(ids)
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
        <h3>Viáticos / Gastos a recuperar</h3>
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
              aria-label="Exportar viáticos"
              title="Exportar viáticos"
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
          {items.map((v) => {
            const isSelected = selected.has(v.id)
            const wasExported = !!v.exportadoEn
            return (
              <div
                key={v.id}
                className="card"
                onClick={
                  selectMode ? () => toggleSelect(v.id) : undefined
                }
                style={{
                  cursor: selectMode ? 'pointer' : undefined,
                  // Tint rows that have been exported before. Selection
                  // re-saturates the row so the user can see what's about to be
                  // included in the new PDF even if it was already exported.
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
                        toggleSelect(v.id)
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
                    <div className="weight-600 truncate">{v.concepto}</div>
                    <div className="text-xs text-muted">
                      {fmtDate(v.fecha)}
                      {wasExported && (
                        <span style={{ marginLeft: 6 }}>· exportado</span>
                      )}
                    </div>
                  </div>
                  <div className="numeric weight-700">{fmtMoney(v.monto)}</div>
                  {!selectMode && (
                    <>
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
                    </>
                  )}
                </div>
                {v.comprobantePath && (
                  <div className="mt-8">
                    <BlobImage
                      bucket="comprobantes"
                      path={v.comprobantePath}
                      alt="Comprobante"
                      onClick={
                        selectMode
                          ? undefined
                          : () => abrirPreview(v.comprobantePath)
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
            )
          })}
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
              {reading && (
                <div className="text-xs text-muted mt-8">
                  Leyendo comprobante… (los campos se completan solos)
                </div>
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
