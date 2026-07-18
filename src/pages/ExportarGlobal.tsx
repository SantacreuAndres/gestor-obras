import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckSquare, Square, FileDown, Filter } from 'lucide-react'
import {
  obras as obrasApi,
  viaticos as viaticosApi,
  gastos as gastosApi,
} from '../db/db'
import { useLive } from '../hooks/useLive'
import { fmtMoney, fmtDate } from '../lib/format'
import { getDataUrl } from '../lib/storage'
import { exportarPdfCombinado } from '../lib/exportPdf'
import type { Viatico, Gasto, Obra } from '../db/schema'

type RowKind = 'viatico' | 'gasto'
interface Row {
  kind: RowKind
  id: string
  obraId: string
  fecha: string
  concepto: string
  monto: number
  comprobantePath?: string
  exportadoEn?: string | null
  // Sólo aplicable a viáticos
  estado?: 'pendiente' | 'recuperado'
}

const key = (kind: RowKind, id: string) => `${kind}:${id}`

export function ExportarGlobal() {
  const navigate = useNavigate()
  const obras = useLive<Obra[]>('obras', () => obrasApi.list(), []) ?? []
  const viaticos = useLive<Viatico[]>('viaticos', () => viaticosApi.list(), []) ?? []
  // Traemos gastos de todas las obras. Cuando cambia el set de obras hay que
  // re-fetchear; el join en la key garantiza que el efecto se rehaga.
  const gastos =
    useLive<Gasto[]>(
      'gastos',
      async () => {
        const perObra = await Promise.all(
          obras.map((o) => gastosApi.byObra(o.id)),
        )
        return perObra.flat()
      },
      [obras.map((o) => o.id).join(',')],
    ) ?? []

  const obrasMap = useMemo(
    () => Object.fromEntries(obras.map((o) => [o.id, o])),
    [obras],
  )

  // --- Selección
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [onlyPending, setOnlyPending] = useState(true)

  // Al cambiar el filtro "solo pendientes", limpiamos las selecciones que ya
  // no son visibles para que el contador no mienta.
  useEffect(() => {
    setSelected(new Set())
  }, [onlyPending])

  const rows: Row[] = useMemo(() => {
    const all: Row[] = [
      ...viaticos.map<Row>((v) => ({
        kind: 'viatico',
        id: v.id,
        obraId: v.obraId,
        fecha: v.fecha,
        concepto: v.concepto,
        monto: v.monto,
        comprobantePath: v.comprobantePath,
        exportadoEn: v.exportadoEn,
        estado: v.estado,
      })),
      ...gastos.map<Row>((g) => ({
        kind: 'gasto',
        id: g.id,
        obraId: g.obraId,
        fecha: g.fecha,
        concepto: g.concepto,
        monto: g.monto,
        comprobantePath: g.comprobantePath,
        exportadoEn: g.exportadoEn,
      })),
    ]
    return all.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [viaticos, gastos])

  const visibleRows = useMemo(() => {
    if (!onlyPending) return rows
    return rows.filter((r) => {
      // Viáticos: sólo los pendientes de cobrar y no exportados.
      // Gastos: los que no fueron exportados todavía.
      if (r.kind === 'viatico') return r.estado === 'pendiente' && !r.exportadoEn
      return !r.exportadoEn
    })
  }, [rows, onlyPending])

  const grouped = useMemo(() => {
    const byKind: Record<RowKind, Row[]> = { viatico: [], gasto: [] }
    for (const r of visibleRows) byKind[r.kind].push(r)
    return byKind
  }, [visibleRows])

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected.has(key(r.kind, r.id))),
    [visibleRows, selected],
  )
  const selectedTotal = selectedRows.reduce((acc, r) => acc + r.monto, 0)

  function toggle(kind: RowKind, id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = key(kind, id)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function selectAllVisible() {
    setSelected(new Set(visibleRows.map((r) => key(r.kind, r.id))))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function exportarSeleccion() {
    if (selectedRows.length === 0) return
    try {
      setExporting(true)
      // Fetch comprobantes en paralelo, agrupados por tipo. Cada item lleva
      // el nombre de la obra para que la tabla del PDF lo muestre.
      const buildItems = async (rows: Row[]) =>
        Promise.all(
          rows.map(async (r) => ({
            fecha: r.fecha,
            concepto: r.concepto,
            monto: r.monto,
            obra: obrasMap[r.obraId]?.nombre ?? '—',
            comprobanteDataUrl: r.comprobantePath
              ? (await getDataUrl('comprobantes', r.comprobantePath)) ?? undefined
              : undefined,
          })),
        )

      const [viaticosItems, gastosItems] = await Promise.all([
        buildItems(
          selectedRows
            .filter((r) => r.kind === 'viatico')
            .sort((a, b) => a.fecha.localeCompare(b.fecha)),
        ),
        buildItems(
          selectedRows
            .filter((r) => r.kind === 'gasto')
            .sort((a, b) => a.fecha.localeCompare(b.fecha)),
        ),
      ])

      await exportarPdfCombinado({
        viaticos: viaticosItems,
        gastos: gastosItems,
      })

      // Marcamos como exportados en cada tabla.
      const viaticosIds = selectedRows.filter((r) => r.kind === 'viatico').map((r) => r.id)
      const gastosIds = selectedRows.filter((r) => r.kind === 'gasto').map((r) => r.id)
      await Promise.all([
        viaticosApi.markExported(viaticosIds),
        gastosApi.markExported(gastosIds),
      ])
      clearSelection()
    } catch (err) {
      alert('No se pudo exportar el PDF: ' + (err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const totalVisible = visibleRows.reduce((acc, r) => acc + r.monto, 0)

  return (
    <div className="page">
      <button className="btn btn-ghost mb-12" onClick={() => navigate('/obras')}>
        <ArrowLeft size={16} /> Obras
      </button>

      <div className="row-between gap-12 mb-12" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1>Exportar</h1>
          <div className="text-sm text-soft">
            Viáticos + gastos de todas las obras
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">A cobrar</div>
          <div className="kpi-value numeric">{fmtMoney(totalVisible)}</div>
          <div className="kpi-foot">
            {visibleRows.length} ítem{visibleRows.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Seleccionados</div>
          <div className="kpi-value numeric">{fmtMoney(selectedTotal)}</div>
          <div className="kpi-foot">
            {selectedRows.length} ítem{selectedRows.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div
        className="row-between gap-8 mb-12"
        style={{
          background: 'rgba(255, 255, 255, 0.32)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 12px',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setOnlyPending((v) => !v)}
          aria-pressed={onlyPending}
        >
          <Filter size={14} /> {onlyPending ? 'Solo pendientes' : 'Todos'}
        </button>
        <div className="row gap-8">
          <button
            className="btn btn-ghost btn-sm"
            onClick={selectAllVisible}
            disabled={visibleRows.length === 0}
          >
            Todos
          </button>
          {selected.size > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
              Limpiar
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={exportarSeleccion}
            disabled={selectedRows.length === 0 || exporting}
          >
            <FileDown size={14} /> {exporting ? 'Generando…' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <Seccion
        titulo="Viáticos"
        rows={grouped.viatico}
        selected={selected}
        onToggle={toggle}
        obrasMap={obrasMap}
      />
      <Seccion
        titulo="Gastos"
        rows={grouped.gasto}
        selected={selected}
        onToggle={toggle}
        obrasMap={obrasMap}
      />
    </div>
  )
}

interface SeccionProps {
  titulo: string
  rows: Row[]
  selected: Set<string>
  onToggle: (kind: RowKind, id: string) => void
  obrasMap: Record<string, Obra>
}

function Seccion({ titulo, rows, selected, onToggle, obrasMap }: SeccionProps) {
  if (rows.length === 0) {
    return (
      <div className="mt-16">
        <div className="section-head">
          <span>{titulo}</span>
        </div>
        <div className="text-sm text-muted" style={{ padding: '4px 4px' }}>
          Sin ítems para mostrar.
        </div>
      </div>
    )
  }
  const total = rows.reduce((acc, r) => acc + r.monto, 0)
  return (
    <div className="mt-16">
      <div className="section-head">
        <span>{titulo}</span>
        <span className="numeric weight-600">{fmtMoney(total)}</span>
      </div>
      <div className="list">
        {rows.map((r) => {
          const k = key(r.kind, r.id)
          const isSelected = selected.has(k)
          const wasExported = !!r.exportadoEn
          const obraNombre = obrasMap[r.obraId]?.nombre ?? '—'
          return (
            <div
              key={k}
              className="card"
              onClick={() => onToggle(r.kind, r.id)}
              style={{
                cursor: 'pointer',
                opacity: wasExported && !isSelected ? 0.55 : 1,
                filter:
                  wasExported && !isSelected ? 'grayscale(0.7)' : undefined,
                outline: isSelected ? '2px solid var(--c-accent)' : undefined,
                transition:
                  'opacity 0.15s, filter 0.15s, outline-color 0.15s',
              }}
            >
              <div className="row-between gap-8">
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(r.kind, r.id)
                  }}
                  aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                  style={{
                    color: isSelected
                      ? 'var(--c-accent)'
                      : 'var(--c-text-soft)',
                  }}
                >
                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
                <div className="col" style={{ minWidth: 0, flex: 1 }}>
                  <div className="weight-600 truncate">{r.concepto}</div>
                  <div className="text-xs text-muted truncate">
                    {fmtDate(r.fecha)} · {obraNombre}
                    {wasExported && (
                      <span style={{ marginLeft: 6 }}>· exportado</span>
                    )}
                  </div>
                </div>
                <div className="numeric weight-700">{fmtMoney(r.monto)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
