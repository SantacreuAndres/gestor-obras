import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ShoppingCart,
  Boxes,
  Minus,
  CheckCircle2,
} from 'lucide-react'
import { useObra } from '../ObraDetail'
import { materiales as materialesApi, contactos as contactosApi } from '../../db/db'
import { useLive } from '../../hooks/useLive'
import type { Material, UnidadMaterial } from '../../db/schema'
import { uid } from '../../lib/ids'
import { fmtMoney, fmtNumber, UNIDAD_LABEL } from '../../lib/format'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'

const UNIDADES: UnidadMaterial[] = ['bolsas', 'm2', 'm3', 'kg', 'litros', 'unidades', 'ml']

const blank = (obraId: string): Partial<Material> => ({
  obraId,
  nombre: '',
  unidad: 'unidades',
  precioUnitario: 0,
  estimado: 0,
  comprado: 0,
  consumido: 0,
  pedirManual: false,
})

export function Materiales() {
  const obra = useObra()
  const [tab, setTab] = useState<'stock' | 'pedido'>('stock')
  const [editing, setEditing] = useState<Partial<Material> | null>(null)
  const items = useLive('materiales', () => materialesApi.byObra(obra.id), [obra.id]) ?? []
  const contactos = useLive('contactos', () => contactosApi.list(), []) ?? []

  const proveedores = useMemo(
    () => contactos.filter((c) => c.rol === 'proveedor'),
    [contactos],
  )
  const proveedorPorId = useMemo(
    () => Object.fromEntries(contactos.map((c) => [c.id, c])),
    [contactos],
  )

  async function save() {
    if (!editing?.nombre?.trim()) return
    const id = editing.id ?? uid()
    await materialesApi.put({
      id,
      obraId: obra.id,
      nombre: editing.nombre.trim(),
      unidad: (editing.unidad ?? 'unidades') as UnidadMaterial,
      precioUnitario: Number(editing.precioUnitario ?? 0),
      proveedorId: editing.proveedorId || undefined,
      estimado: Number(editing.estimado ?? 0),
      comprado: Number(editing.comprado ?? 0),
      consumido: Number(editing.consumido ?? 0),
      pedirManual: !!editing.pedirManual,
    })
    setEditing(null)
  }

  async function bump(m: Material, field: 'comprado' | 'consumido', delta: number) {
    const next = Math.max(0, (m[field] ?? 0) + delta)
    await materialesApi.update(m.id, { [field]: next })
  }

  async function borrar(id: string) {
    await materialesApi.delete(id)
  }

  async function toggleManual(m: Material) {
    await materialesApi.update(m.id, { pedirManual: !m.pedirManual })
  }

  const aPedirItems = items
    .map((m) => ({
      ...m,
      restante: m.comprado - m.consumido,
      aPedirCalc: Math.max(0, m.estimado - m.comprado),
    }))
    .filter((m) => m.aPedirCalc > 0 || m.pedirManual)

  const aPedirAgrupado = useMemo(() => {
    const groups: Record<string, typeof aPedirItems> = {}
    aPedirItems.forEach((m) => {
      const key = m.proveedorId ?? '__sin_proveedor__'
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return groups
  }, [aPedirItems])

  return (
    <>
      <div className="row-between mb-12">
        <h3>Materiales</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setEditing(blank(obra.id))}
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      <div className="filter-bar">
        <button
          className={'chip ' + (tab === 'stock' ? 'active' : '')}
          onClick={() => setTab('stock')}
        >
          <Boxes size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Stock ({items.length})
        </button>
        <button
          className={'chip ' + (tab === 'pedido' ? 'active' : '')}
          onClick={() => setTab('pedido')}
        >
          <ShoppingCart size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Lista de pedido ({aPedirItems.length})
        </button>
      </div>

      {tab === 'stock' &&
        (items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Sin materiales todavía"
            subtitle="Cargá materiales con cantidad estimada para empezar a controlar stock."
          />
        ) : (
          <div className="list">
            {items.map((m) => {
              const restante = m.comprado - m.consumido
              const aPedir = Math.max(0, m.estimado - m.comprado)
              return (
                <div key={m.id} className="card">
                  <div className="row-between gap-8">
                    <div className="col" style={{ minWidth: 0 }}>
                      <div className="weight-600 truncate">{m.nombre}</div>
                      <div className="text-xs text-muted">
                        {fmtMoney(m.precioUnitario)} / {UNIDAD_LABEL[m.unidad]}
                        {m.proveedorId && proveedorPorId[m.proveedorId] && (
                          <> · {proveedorPorId[m.proveedorId].nombre}</>
                        )}
                      </div>
                    </div>
                    <div className="row gap-4">
                      <button
                        className="btn-icon"
                        onClick={() => toggleManual(m)}
                        aria-label="Marcar para pedir"
                        style={{
                          color: m.pedirManual ? 'var(--c-accent)' : undefined,
                        }}
                      >
                        <ShoppingCart size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setEditing(m)}
                        aria-label="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => borrar(m.id)}
                        aria-label="Borrar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div
                    className="row gap-12 mt-8"
                    style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}
                  >
                    <Stat label="Estimado" valor={m.estimado} unidad={m.unidad} />
                    <CounterStat
                      label="Comprado"
                      valor={m.comprado}
                      unidad={m.unidad}
                      onMinus={() => bump(m, 'comprado', -1)}
                      onPlus={() => bump(m, 'comprado', 1)}
                    />
                    <CounterStat
                      label="Consumido"
                      valor={m.consumido}
                      unidad={m.unidad}
                      onMinus={() => bump(m, 'consumido', -1)}
                      onPlus={() => bump(m, 'consumido', 1)}
                    />
                    <Stat
                      label="Restante"
                      valor={restante}
                      unidad={m.unidad}
                      tone={restante <= 0 ? 'danger' : restante < m.estimado * 0.1 ? 'warn' : undefined}
                    />
                    <Stat
                      label="A pedir"
                      valor={aPedir}
                      unidad={m.unidad}
                      tone={aPedir > 0 ? 'accent' : 'success'}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ))}

      {tab === 'pedido' &&
        (aPedirItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No hay nada para pedir"
            subtitle="Todos los materiales están comprados según lo estimado."
          />
        ) : (
          <div className="col gap-16">
            {Object.entries(aPedirAgrupado).map(([provId, lista]) => {
              const prov = provId !== '__sin_proveedor__' ? proveedorPorId[provId] : null
              const total = lista.reduce(
                (acc, m) => acc + Math.max(m.aPedirCalc, 0) * m.precioUnitario,
                0,
              )
              return (
                <div key={provId} className="card">
                  <div className="row-between mb-8">
                    <div className="weight-700">
                      {prov ? prov.nombre : 'Sin proveedor asignado'}
                    </div>
                    <span className="badge badge-accent numeric">
                      {fmtMoney(total)}
                    </span>
                  </div>
                  <div className="list">
                    {lista.map((m) => (
                      <div key={m.id} className="row-between text-sm">
                        <span className="truncate">{m.nombre}</span>
                        <span className="numeric text-soft">
                          {fmtNumber(Math.max(m.aPedirCalc, 0))} {UNIDAD_LABEL[m.unidad]}
                          {m.pedirManual && m.aPedirCalc === 0 && (
                            <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                              manual
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar material' : 'Nuevo material'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!editing?.nombre?.trim()}
            >
              Guardar
            </button>
          </>
        }
      >
        {editing && (
          <>
            <div className="field">
              <label className="field-label">Nombre *</label>
              <input
                className="input"
                autoFocus
                value={editing.nombre ?? ''}
                onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                placeholder="Ej. Cemento, Ladrillo común, Cable 2.5mm…"
              />
            </div>
            <div className="row gap-8">
              <div className="field flex-1">
                <label className="field-label">Unidad</label>
                <select
                  className="select"
                  value={editing.unidad ?? 'unidades'}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      unidad: e.target.value as UnidadMaterial,
                    })
                  }
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {UNIDAD_LABEL[u]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field flex-1">
                <label className="field-label">Precio unitario</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={editing.precioUnitario ?? 0}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      precioUnitario: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Proveedor</label>
              <select
                className="select"
                value={editing.proveedorId ?? ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    proveedorId: e.target.value || undefined,
                  })
                }
              >
                <option value="">— sin asignar —</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {proveedores.length === 0 && (
                <span className="text-xs text-muted">
                  Cargá un contacto con rol "Proveedor" en la pestaña Contactos.
                </span>
              )}
            </div>

            <div className="row gap-8">
              <div className="field flex-1">
                <label className="field-label">Estimado</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={editing.estimado ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, estimado: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field flex-1">
                <label className="field-label">Comprado</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={editing.comprado ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, comprado: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field flex-1">
                <label className="field-label">Consumido</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={editing.consumido ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, consumido: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <label className="row gap-8">
              <input
                type="checkbox"
                checked={!!editing.pedirManual}
                onChange={(e) =>
                  setEditing({ ...editing, pedirManual: e.target.checked })
                }
              />
              <span className="text-sm">
                Marcar manualmente para incluir en lista de pedido
              </span>
            </label>
          </>
        )}
      </Modal>
    </>
  )
}

function Stat({
  label,
  valor,
  unidad,
  tone,
}: {
  label: string
  valor: number
  unidad: UnidadMaterial
  tone?: 'danger' | 'warn' | 'accent' | 'success'
}) {
  const color =
    tone === 'danger'
      ? 'var(--c-danger)'
      : tone === 'warn'
        ? 'var(--c-warn)'
        : tone === 'accent'
          ? 'var(--c-accent)'
          : tone === 'success'
            ? 'var(--c-success)'
            : undefined
  return (
    <div className="col" style={{ minWidth: 80 }}>
      <span className="text-xs text-muted">{label}</span>
      <span className="numeric weight-700" style={{ color }}>
        {fmtNumber(valor)}{' '}
        <span className="text-xs text-soft weight-600">{UNIDAD_LABEL[unidad]}</span>
      </span>
    </div>
  )
}

function CounterStat({
  label,
  valor,
  unidad,
  onMinus,
  onPlus,
}: {
  label: string
  valor: number
  unidad: UnidadMaterial
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div className="col" style={{ minWidth: 110 }}>
      <span className="text-xs text-muted">{label}</span>
      <div className="row gap-6">
        <button
          className="btn-icon btn-sm"
          onClick={onMinus}
          aria-label="-1"
          style={{ width: 26, height: 26 }}
        >
          <Minus size={12} />
        </button>
        <span className="numeric weight-700">
          {fmtNumber(valor)}{' '}
          <span className="text-xs text-soft weight-600">{UNIDAD_LABEL[unidad]}</span>
        </span>
        <button
          className="btn-icon btn-sm"
          onClick={onPlus}
          aria-label="+1"
          style={{ width: 26, height: 26 }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
