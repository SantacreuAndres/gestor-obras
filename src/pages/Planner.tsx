import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarPlus,
  CalendarMinus,
  Check,
  Circle,
  CircleDot,
  CalendarDays,
} from 'lucide-react'
import { plannerApi, calendarApi } from '../db/api'
import { supabase } from '../lib/supabase'
import { triggerBackgroundSync } from '../lib/googleSync'
import { uid } from '../lib/ids'
import type { EstadoTarea, PlannerTarea } from '../db/schema'

dayjs.extend(isoWeek)

const ESTADO_NEXT: Record<EstadoTarea, EstadoTarea> = {
  pendiente: 'progreso',
  progreso: 'hecha',
  hecha: 'pendiente',
}

const ESTADO_COLOR: Record<EstadoTarea, string> = {
  pendiente: '#dc2626',
  progreso: '#f59e0b',
  hecha: '#16a34a',
}

const ESTADO_LABEL: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  progreso: 'En progreso',
  hecha: 'Hecha',
}

const DIA_NOMBRE = ['lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.', 'dom.']

export function Planner() {
  // Anchor on the ISO Monday of the week being viewed.
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek'))
  const [tareas, setTareas] = useState<PlannerTarea[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftForDay, setDraftForDay] = useState<string | null>(null)

  const weekEnd = useMemo(() => weekStart.add(6, 'day'), [weekStart])

  useEffect(() => {
    setLoading(true)
    plannerApi
      .byRange(weekStart.format('YYYY-MM-DD'), weekEnd.format('YYYY-MM-DD'))
      .then(setTareas)
      .catch((e) => {
        console.error('planner load error', e)
        setTareas([])
      })
      .finally(() => setLoading(false))
  }, [weekStart, weekEnd])

  // Realtime: refresca cuando hay cambios en la tabla para este usuario.
  useEffect(() => {
    const ch = supabase
      .channel('planner_tareas_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planner_tareas' },
        () => {
          plannerApi
            .byRange(weekStart.format('YYYY-MM-DD'), weekEnd.format('YYYY-MM-DD'))
            .then(setTareas)
            .catch(() => {})
        },
      )
      .subscribe()
    return () => {
      ch.unsubscribe()
    }
  }, [weekStart, weekEnd])

  // Group tasks by date (YYYY-MM-DD)
  const tareasByDate = useMemo(() => {
    const m: Record<string, PlannerTarea[]> = {}
    for (const t of tareas) {
      ;(m[t.fecha] ||= []).push(t)
    }
    return m
  }, [tareas])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')),
    [weekStart],
  )

  async function ciclarEstado(t: PlannerTarea) {
    const next = ESTADO_NEXT[t.estado]
    setTareas((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, estado: next } : x)),
    )
    try {
      await plannerApi.update(t.id, { estado: next })
    } catch (e) {
      alert(`No pude cambiar el estado:\n${(e as Error).message}`)
      // revert
      setTareas((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, estado: t.estado } : x)),
      )
    }
  }

  async function setEstado(t: PlannerTarea, estado: EstadoTarea) {
    if (estado === t.estado) return
    setTareas((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, estado } : x)),
    )
    try {
      await plannerApi.update(t.id, { estado })
    } catch (e) {
      alert(`No pude cambiar el estado:\n${(e as Error).message}`)
    }
  }

  async function borrar(t: PlannerTarea) {
    if (!window.confirm(`¿Borrar "${t.titulo}"?`)) return
    // If linked to calendar, remove that event too.
    if (t.calendarEventId) {
      try {
        await calendarApi.delete(t.calendarEventId)
        void triggerBackgroundSync()
      } catch (e) {
        console.warn('failed to delete linked calendar event', e)
      }
    }
    setTareas((prev) => prev.filter((x) => x.id !== t.id))
    try {
      await plannerApi.delete(t.id)
    } catch (e) {
      alert(`No pude borrar:\n${(e as Error).message}`)
    }
  }

  async function toggleCalendarLink(t: PlannerTarea) {
    if (t.calendarEventId) {
      // Unlink: borrar event y dejar la tarea suelta
      try {
        await calendarApi.delete(t.calendarEventId)
        await plannerApi.update(t.id, { calendarEventId: null })
        setTareas((prev) =>
          prev.map((x) =>
            x.id === t.id ? { ...x, calendarEventId: null } : x,
          ),
        )
        void triggerBackgroundSync()
      } catch (e) {
        alert(`No pude desvincular:\n${(e as Error).message}`)
      }
      return
    }
    // Link: crear event en calendar_events, referenciarlo desde la tarea, y
    // si el segundo paso falla, hacer rollback borrando el evento huérfano.
    const eventId = crypto.randomUUID()
    try {
      await calendarApi.put({
        id: eventId,
        userId: '', // calendarApi.put lo sobreescribe con la sesión real
        title: t.titulo,
        description: t.descripcion ?? undefined,
        eventDate: t.fecha,
        eventTime: t.hora ?? undefined,
        reminderMinutes: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (e) {
      alert(`No pude crear el evento:\n${(e as Error).message}`)
      return
    }
    try {
      await plannerApi.update(t.id, { calendarEventId: eventId })
    } catch (e) {
      // Rollback: borrar el evento huérfano que acabamos de crear.
      await calendarApi.delete(eventId).catch(() => {})
      alert(`No pude vincular al calendario:\n${(e as Error).message}`)
      return
    }
    setTareas((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, calendarEventId: eventId } : x)),
    )
    void triggerBackgroundSync()
  }

  const labelSemana = `${weekStart.format('D MMM')} – ${weekEnd.format('D MMM YYYY')}`

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Planner</div>
          <div className="page-subtitle">{labelSemana}</div>
        </div>
        <div className="row gap-8">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(weekStart.subtract(1, 'week'))}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(dayjs().startOf('isoWeek'))}
          >
            Hoy
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(weekStart.add(1, 'week'))}
            aria-label="Semana siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-soft" style={{ padding: 24, textAlign: 'center' }}>
          Cargando…
        </div>
      )}

      {!loading && (
        <div className="col gap-12">
          {days.map((d, i) => {
            const fecha = d.format('YYYY-MM-DD')
            const isToday = d.isSame(dayjs(), 'day')
            const list = tareasByDate[fecha] ?? []
            return (
              <DiaSection
                key={fecha}
                fecha={fecha}
                titulo={`${DIA_NOMBRE[i]} ${d.format('D MMM')}`}
                isToday={isToday}
                tareas={list}
                editingId={editingId}
                draftOpen={draftForDay === fecha}
                onOpenDraft={() => setDraftForDay(fecha)}
                onCloseDraft={() => setDraftForDay(null)}
                onCiclarEstado={ciclarEstado}
                onSetEstado={setEstado}
                onBorrar={borrar}
                onToggleCalendar={toggleCalendarLink}
                onStartEdit={(id) => setEditingId(id)}
                onStopEdit={() => setEditingId(null)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

interface DiaSectionProps {
  fecha: string
  titulo: string
  isToday: boolean
  tareas: PlannerTarea[]
  editingId: string | null
  draftOpen: boolean
  onOpenDraft: () => void
  onCloseDraft: () => void
  onCiclarEstado: (t: PlannerTarea) => void
  onSetEstado: (t: PlannerTarea, e: EstadoTarea) => void
  onBorrar: (t: PlannerTarea) => void
  onToggleCalendar: (t: PlannerTarea) => void
  onStartEdit: (id: string) => void
  onStopEdit: () => void
}

function DiaSection(p: DiaSectionProps) {
  return (
    <section
      className="card"
      style={{
        padding: 12,
        background: p.isToday ? '#fff7ed' : undefined,
        borderColor: p.isToday ? 'var(--c-accent)' : undefined,
      }}
    >
      <div
        className="row-between"
        style={{ alignItems: 'baseline', marginBottom: 8 }}
      >
        <div className="row gap-8" style={{ alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1.05rem' }}>{p.titulo}</strong>
          {p.isToday && (
            <span
              className="text-xs"
              style={{
                color: 'var(--c-accent)',
                background: 'var(--c-accent-soft)',
                padding: '2px 8px',
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              hoy
            </span>
          )}
        </div>
        <span className="text-xs text-soft">{p.tareas.length} tarea{p.tareas.length === 1 ? '' : 's'}</span>
      </div>

      <div className="col gap-8">
        {p.tareas.map((t) => (
          <TareaRow
            key={t.id}
            t={t}
            editing={p.editingId === t.id}
            onCiclarEstado={() => p.onCiclarEstado(t)}
            onSetEstado={(e) => p.onSetEstado(t, e)}
            onBorrar={() => p.onBorrar(t)}
            onToggleCalendar={() => p.onToggleCalendar(t)}
            onStartEdit={() => p.onStartEdit(t.id)}
            onStopEdit={p.onStopEdit}
          />
        ))}
        {p.draftOpen ? (
          <DraftRow
            fecha={p.fecha}
            onClose={p.onCloseDraft}
          />
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={p.onOpenDraft}
            style={{ alignSelf: 'flex-start' }}
          >
            <Plus size={14} /> Agregar tarea
          </button>
        )}
      </div>
    </section>
  )
}

interface TareaRowProps {
  t: PlannerTarea
  editing: boolean
  onCiclarEstado: () => void
  onSetEstado: (e: EstadoTarea) => void
  onBorrar: () => void
  onToggleCalendar: () => void
  onStartEdit: () => void
  onStopEdit: () => void
}

function TareaRow({
  t,
  editing,
  onCiclarEstado,
  onSetEstado,
  onBorrar,
  onToggleCalendar,
  onStartEdit,
  onStopEdit,
}: TareaRowProps) {
  const [titulo, setTitulo] = useState(t.titulo)
  const [hora, setHora] = useState(t.hora ?? '')
  const [descripcion, setDescripcion] = useState(t.descripcion ?? '')
  const [showEstadoMenu, setShowEstadoMenu] = useState(false)
  const longPressTimerRef = useState<{ id: number | null }>({ id: null })[0]

  useEffect(() => {
    setTitulo(t.titulo)
    setHora(t.hora ?? '')
    setDescripcion(t.descripcion ?? '')
  }, [t.id, t.titulo, t.hora, t.descripcion])

  async function guardarEdicion() {
    const newTitulo = titulo.trim()
    if (!newTitulo) {
      onStopEdit()
      return
    }
    try {
      await plannerApi.update(t.id, {
        titulo: newTitulo,
        hora: hora || null,
        descripcion: descripcion || null,
      })
      onStopEdit()
    } catch (e) {
      alert(`No pude guardar:\n${(e as Error).message}`)
    }
  }

  function handlePointerDown() {
    longPressTimerRef.id = window.setTimeout(() => {
      setShowEstadoMenu(true)
      longPressTimerRef.id = null
    }, 500)
  }

  function handlePointerUp() {
    if (longPressTimerRef.id != null) {
      clearTimeout(longPressTimerRef.id)
      longPressTimerRef.id = null
      onCiclarEstado()
    }
  }

  function handlePointerCancel() {
    if (longPressTimerRef.id != null) {
      clearTimeout(longPressTimerRef.id)
      longPressTimerRef.id = null
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        background: 'var(--c-bg-soft)',
        border: '1px solid var(--c-border)',
        borderRadius: 8,
        opacity: t.estado === 'hecha' ? 0.7 : 1,
      }}
    >
      <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
        <Semaforo
          estado={t.estado}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerCancel}
          onPointerCancel={handlePointerCancel}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div className="col gap-4">
              <input
                className="input"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void guardarEdicion()
                  if (e.key === 'Escape') onStopEdit()
                }}
              />
              <div className="row gap-8">
                <input
                  type="time"
                  className="input"
                  style={{ width: 110 }}
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Notas (opcional)"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>
              <div className="row gap-8">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void guardarEdicion()}
                >
                  Guardar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onStopEdit}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div onClick={onStartEdit} style={{ cursor: 'pointer' }}>
              <div
                style={{
                  fontWeight: 600,
                  textDecoration: t.estado === 'hecha' ? 'line-through' : 'none',
                }}
              >
                {t.titulo}
              </div>
              {(t.hora || t.descripcion) && (
                <div className="text-sm text-soft">
                  {t.hora ? t.hora.slice(0, 5) : ''}
                  {t.hora && t.descripcion ? ' · ' : ''}
                  {t.descripcion ?? ''}
                </div>
              )}
            </div>
          )}
        </div>
        {!editing && (
          <div className="row gap-4">
            <button
              className="btn-icon"
              onClick={onToggleCalendar}
              aria-label={
                t.calendarEventId
                  ? 'Quitar del calendario'
                  : 'Agregar al calendario'
              }
              title={
                t.calendarEventId
                  ? 'En el calendario — tocar para quitar'
                  : 'Agregar al calendario (Google/Apple)'
              }
              style={{
                color: t.calendarEventId ? 'var(--c-accent)' : undefined,
              }}
            >
              {t.calendarEventId ? (
                <CalendarMinus size={16} />
              ) : (
                <CalendarPlus size={16} />
              )}
            </button>
            <button className="btn-icon" onClick={onBorrar} aria-label="Borrar">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {showEstadoMenu && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '4px 0 0 30px',
            flexWrap: 'wrap',
          }}
        >
          {(['pendiente', 'progreso', 'hecha'] as EstadoTarea[]).map((e) => (
            <button
              key={e}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                borderColor: e === t.estado ? ESTADO_COLOR[e] : undefined,
                color: ESTADO_COLOR[e],
              }}
              onClick={() => {
                onSetEstado(e)
                setShowEstadoMenu(false)
              }}
            >
              {ESTADO_LABEL[e]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowEstadoMenu(false)}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}

function Semaforo({
  estado,
  ...handlers
}: {
  estado: EstadoTarea
  onPointerDown: () => void
  onPointerUp: () => void
  onPointerLeave: () => void
  onPointerCancel: () => void
}) {
  const color = ESTADO_COLOR[estado]
  const Icon =
    estado === 'hecha' ? Check : estado === 'progreso' ? CircleDot : Circle
  return (
    <button
      type="button"
      aria-label={`Estado: ${ESTADO_LABEL[estado]}. Tocá para avanzar, mantené para elegir.`}
      title={`${ESTADO_LABEL[estado]} — tocá para cambiar`}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        border: 0,
        flexShrink: 0,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
      {...handlers}
    >
      <Icon size={16} strokeWidth={3} />
    </button>
  )
}

function DraftRow({ fecha, onClose }: { fecha: string; onClose: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [hora, setHora] = useState('')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    const t = titulo.trim()
    if (!t) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await plannerApi.add({
        id: uid(),
        fecha,
        hora: hora || null,
        titulo: t,
        estado: 'pendiente',
      })
      onClose()
    } catch (e) {
      alert(`No pude crear:\n${(e as Error).message}`)
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        background: 'var(--c-bg-soft)',
        border: '1px dashed var(--c-accent)',
        borderRadius: 8,
      }}
    >
      <input
        className="input"
        autoFocus
        placeholder="¿Qué tenés que hacer?"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void guardar()
          if (e.key === 'Escape') onClose()
        }}
        disabled={saving}
      />
      <div className="row gap-8">
        <input
          type="time"
          className="input"
          style={{ width: 110 }}
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          disabled={saving}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void guardar()}
          disabled={saving || !titulo.trim()}
        >
          <CalendarDays size={14} /> Crear
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
