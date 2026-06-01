import { createContext, useContext, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MapPin,
  CalendarClock,
  User,
  FileText,
  StickyNote,
  AlarmClock,
  FolderOpen,
  Package,
  Camera,
  Wallet,
  Receipt,
  ClipboardList,
} from 'lucide-react'
import { obras as obrasApi, deleteObraCompleta } from '../db/db'
import { useLive } from '../hooks/useLive'
import type { Obra } from '../db/schema'
import {
  ETAPA_LABEL,
  ESTADO_OBRA_LABEL,
  TIPO_OBRA_LABEL,
  fmtDate,
} from '../lib/format'
import { ObraFormModal } from '../components/ObraFormModal'

const ObraCtx = createContext<Obra | null>(null)
export function useObra(): Obra {
  const o = useContext(ObraCtx)
  if (!o) throw new Error('useObra fuera de contexto')
  return o
}

const TABS = [
  { to: 'datos', label: 'Datos', icon: FileText },
  { to: 'notas', label: 'Notas', icon: StickyNote },
  { to: 'deadlines', label: 'Deadlines', icon: AlarmClock },
  { to: 'materiales', label: 'Materiales', icon: Package },
  { to: 'viaticos', label: 'Viáticos', icon: Receipt },
  { to: 'documentos', label: 'Documentos', icon: FolderOpen },
  { to: 'fotos', label: 'Fotos', icon: Camera },
  { to: 'plata', label: 'Plata', icon: Wallet },
  { to: 'medicion', label: 'Medición', icon: ClipboardList },
]

export function ObraDetail() {
  const { obraId } = useParams<{ obraId: string }>()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const obra = useLive(
    'obras',
    () => (obraId ? obrasApi.get(obraId) : Promise.resolve(null)),
    [obraId],
  )

  if (obra === undefined) {
    return <div className="page text-soft">Cargando…</div>
  }
  if (obra === null) {
    return (
      <div className="page">
        <button className="btn btn-ghost mb-12" onClick={() => navigate('/obras')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="empty">Obra no encontrada.</div>
      </div>
    )
  }

  async function onDelete() {
    await deleteObraCompleta(obra!.id)
    navigate('/obras')
  }

  return (
    <ObraCtx.Provider value={obra}>
      <div className="page">
        <button className="btn btn-ghost mb-12" onClick={() => navigate('/obras')}>
          <ArrowLeft size={16} /> Obras
        </button>

        <div className="row-between gap-12 mb-12" style={{ flexWrap: 'wrap' }}>
          <div className="col gap-4" style={{ minWidth: 0 }}>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <h1>{obra.nombre}</h1>
              <span className="badge badge-accent">{ETAPA_LABEL[obra.etapa]}</span>
              {obra.estado !== 'activa' && (
                <span className="badge">{ESTADO_OBRA_LABEL[obra.estado]}</span>
              )}
            </div>
            <div
              className="row gap-12 text-sm text-soft"
              style={{ flexWrap: 'wrap' }}
            >
              {obra.comitente && (
                <span className="row gap-4">
                  <User size={14} /> {obra.comitente}
                </span>
              )}
              {obra.direccion && (
                <span className="row gap-4">
                  <MapPin size={14} /> {obra.direccion}
                </span>
              )}
              {obra.fechaEntregaEstimada && (
                <span className="row gap-4">
                  <CalendarClock size={14} /> Entrega{' '}
                  {fmtDate(obra.fechaEntregaEstimada)}
                </span>
              )}
              <span className="text-muted">{TIPO_OBRA_LABEL[obra.tipo]}</span>
            </div>
          </div>
          <div className="row gap-8">
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Editar
            </button>
            <button
              className="btn btn-danger btn-icon"
              onClick={() => setConfirmDel(true)}
              aria-label="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {confirmDel && (
          <div className="confirm-strip mb-12">
            <span className="confirm-strip-text">
              ¿Eliminar la obra y todo su contenido?
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDel(false)}
            >
              Cancelar
            </button>
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              Eliminar
            </button>
          </div>
        )}

        <div className="tabs-obra">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                'tab-link' + (isActive ? ' active' : '')
              }
            >
              <span className="row gap-6">
                <t.icon size={14} />
                {t.label}
              </span>
            </NavLink>
          ))}
        </div>

        <Outlet />

        <ObraFormModal
          open={editing}
          onClose={() => setEditing(false)}
          obraId={obra.id}
        />
      </div>
    </ObraCtx.Provider>
  )
}
