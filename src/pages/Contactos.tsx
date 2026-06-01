import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Users,
  Search,
  Link as LinkIcon,
} from 'lucide-react'
import {
  contactos as contactosApi,
  contactoObra as contactoObraApi,
  obras as obrasApi,
} from '../db/db'
import { useLive } from '../hooks/useLive'
import type { Contacto, RolContacto } from '../db/schema'
import { uid } from '../lib/ids'
import { ROL_CONTACTO_LABEL } from '../lib/format'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'

const ROLES: RolContacto[] = [
  'albanil',
  'electricista',
  'plomero',
  'pintor',
  'gremio_otro',
  'proveedor',
  'comitente',
]

const blank = (): Partial<Contacto> => ({
  nombre: '',
  rol: 'proveedor',
})

export function Contactos() {
  const [editing, setEditing] = useState<Partial<Contacto> | null>(null)
  const [vinculando, setVinculando] = useState<Contacto | null>(null)
  const [q, setQ] = useState('')
  const [rolFilter, setRolFilter] = useState<string>('todos')

  const contactos = useLive('contactos', () => contactosApi.list(), []) ?? []
  const vinculos = useLive('contacto_obra', () => contactoObraApi.list(), []) ?? []
  const obras = useLive('obras', () => obrasApi.list(), []) ?? []

  const obrasPorContacto = useMemo(() => {
    const map: Record<string, typeof obras> = {}
    const obraIdx = Object.fromEntries(obras.map((o) => [o.id, o]))
    vinculos.forEach((v) => {
      if (!map[v.contactoId]) map[v.contactoId] = []
      if (obraIdx[v.obraId]) map[v.contactoId].push(obraIdx[v.obraId])
    })
    return map
  }, [vinculos, obras])

  const filtrados = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return contactos.filter((c) => {
      if (rolFilter !== 'todos' && c.rol !== rolFilter) return false
      if (!qq) return true
      return (
        c.nombre.toLowerCase().includes(qq) ||
        (c.telefono ?? '').toLowerCase().includes(qq) ||
        (c.email ?? '').toLowerCase().includes(qq)
      )
    })
  }, [contactos, q, rolFilter])

  async function save() {
    if (!editing?.nombre?.trim()) return
    const id = editing.id ?? uid()
    await contactosApi.put({
      id,
      nombre: editing.nombre.trim(),
      rol: (editing.rol ?? 'proveedor') as RolContacto,
      telefono: editing.telefono?.trim() || undefined,
      email: editing.email?.trim() || undefined,
      notas: editing.notas?.trim() || undefined,
    })
    setEditing(null)
  }

  async function borrar(id: string) {
    // CASCADE limpia contacto_obra
    await contactosApi.delete(id)
  }

  async function toggleVinculo(contactoId: string, obraId: string) {
    const exists = await contactoObraApi.exists(contactoId, obraId)
    if (exists) {
      await contactoObraApi.unlink(contactoId, obraId)
    } else {
      await contactoObraApi.link(contactoId, obraId)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Contactos</div>
          <div className="page-subtitle">
            {contactos.length} en total · únicos globales, se vinculan a obras
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          <Plus size={16} /> Nuevo contacto
        </button>
      </div>

      <div className="field mb-12">
        <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
          <Search size={16} color="var(--c-text-muted)" />
          <input
            placeholder="Buscar por nombre, teléfono o email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              border: 0,
              outline: 'none',
              background: 'transparent',
              flex: 1,
              padding: 4,
              fontSize: '0.95rem',
            }}
          />
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={'chip ' + (rolFilter === 'todos' ? 'active' : '')}
          onClick={() => setRolFilter('todos')}
        >
          Todos
        </button>
        {ROLES.map((r) => (
          <button
            key={r}
            className={'chip ' + (rolFilter === r ? 'active' : '')}
            onClick={() => setRolFilter(r)}
          >
            {ROL_CONTACTO_LABEL[r]}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={Users}
          title={contactos.length === 0 ? 'Sin contactos' : 'Nada con ese filtro'}
          subtitle={
            contactos.length === 0
              ? 'Gremios, proveedores y comitentes viven acá; se vinculan a las obras donde participan.'
              : undefined
          }
        />
      ) : (
        <div className="list">
          {filtrados.map((c) => {
            const obrasVinc = obrasPorContacto[c.id] ?? []
            return (
              <div key={c.id} className="card">
                <div className="row-between">
                  <div className="col" style={{ minWidth: 0 }}>
                    <div className="weight-700 truncate">{c.nombre}</div>
                    <div className="row gap-8 text-sm text-soft" style={{ flexWrap: 'wrap' }}>
                      <span className="badge">{ROL_CONTACTO_LABEL[c.rol]}</span>
                      {c.telefono && (
                        <a className="row gap-4" href={`tel:${c.telefono}`}>
                          <Phone size={13} /> {c.telefono}
                        </a>
                      )}
                      {c.email && (
                        <a className="row gap-4" href={`mailto:${c.email}`}>
                          <Mail size={13} /> {c.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="row gap-4">
                    <button
                      className="btn-icon"
                      onClick={() => setVinculando(c)}
                      aria-label="Vincular a obras"
                    >
                      <LinkIcon size={15} />
                    </button>
                    <button className="btn-icon" onClick={() => setEditing(c)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon" onClick={() => borrar(c.id)} aria-label="Borrar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {obrasVinc.length > 0 && (
                  <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                    {obrasVinc.map((o) => (
                      <span key={o.id} className="badge badge-accent">
                        {o.nombre}
                      </span>
                    ))}
                  </div>
                )}
                {c.notas && (
                  <div className="text-sm text-soft" style={{ whiteSpace: 'pre-wrap' }}>
                    {c.notas}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar contacto' : 'Nuevo contacto'}
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
              />
            </div>
            <div className="field">
              <label className="field-label">Rol</label>
              <select
                className="select"
                value={editing.rol ?? 'proveedor'}
                onChange={(e) =>
                  setEditing({ ...editing, rol: e.target.value as RolContacto })
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROL_CONTACTO_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="row gap-8">
              <div className="field flex-1">
                <label className="field-label">Teléfono</label>
                <input
                  className="input"
                  type="tel"
                  value={editing.telefono ?? ''}
                  onChange={(e) => setEditing({ ...editing, telefono: e.target.value })}
                />
              </div>
              <div className="field flex-1">
                <label className="field-label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={editing.email ?? ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Notas</label>
              <textarea
                className="textarea"
                value={editing.notas ?? ''}
                onChange={(e) => setEditing({ ...editing, notas: e.target.value })}
              />
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!vinculando}
        onClose={() => setVinculando(null)}
        title={vinculando ? `Obras de ${vinculando.nombre}` : ''}
        footer={
          <button className="btn btn-primary" onClick={() => setVinculando(null)}>
            Listo
          </button>
        }
      >
        {vinculando &&
          (obras.length === 0 ? (
            <div className="text-soft">Todavía no hay obras cargadas.</div>
          ) : (
            <div className="col gap-8">
              {obras.map((o) => {
                const vinc = vinculos.some(
                  (v) => v.contactoId === vinculando.id && v.obraId === o.id,
                )
                return (
                  <label key={o.id} className="row gap-8">
                    <input
                      type="checkbox"
                      checked={vinc}
                      onChange={() => toggleVinculo(vinculando.id, o.id)}
                    />
                    <span>{o.nombre}</span>
                  </label>
                )
              })}
            </div>
          ))}
      </Modal>
    </div>
  )
}
