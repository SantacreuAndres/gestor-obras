import { supabase } from '../lib/supabase'
import type {
  Obra,
  Nota,
  Deadline,
  Material,
  Viatico,
  Contacto,
  ContactoObra,
  Documento,
  Foto,
  MovimientoPlata,
  FojaPeriodo,
  FojaItem,
  CalendarEvent,
  PlannerTarea,
} from './schema'

// ============================================================
// Helpers de conversión camelCase ↔ snake_case
// ============================================================
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

function mapKeys(value: unknown, fn: (k: string) => string): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn))
  if (typeof value !== 'object') return value
  // No tocar tipos especiales (Date, Blob, etc.)
  if (
    value instanceof Date ||
    value instanceof Blob ||
    value instanceof ArrayBuffer
  )
    return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[fn(k)] = mapKeys(v, fn)
  }
  return out
}

const fromDb = <T,>(x: unknown): T => mapKeys(x, toCamel) as T
const toDb = (x: unknown): Record<string, unknown> =>
  mapKeys(x, toSnake) as Record<string, unknown>

function unwrap<T>({
  data,
  error,
}: {
  data: unknown
  error: { message?: string } | null
}): T {
  if (error) throw new Error(error.message ?? String(error))
  return fromDb<T>(data)
}

// ============================================================
// OBRAS
// ============================================================
export const obrasApi = {
  list: async (): Promise<Obra[]> =>
    unwrap<Obra[]>(
      await supabase
        .from('obras')
        .select('*')
        .order('updated_at', { ascending: false }),
    ),

  get: async (id: string): Promise<Obra | null> =>
    unwrap<Obra | null>(
      await supabase.from('obras').select('*').eq('id', id).maybeSingle(),
    ),

  put: async (data: Obra): Promise<Obra> =>
    unwrap<Obra>(
      await supabase.from('obras').upsert(toDb(data)).select().single(),
    ),

  delete: async (id: string): Promise<void> => {
    // CASCADE en la DB se encarga de notas, deadlines, materiales, viaticos,
    // contacto_obra, documentos, fotos, plata, foja_periodos, foja_items.
    const { error } = await supabase.from('obras').delete().eq('id', id)
    if (error) throw error
  },

  count: async (): Promise<number> => {
    const { count, error } = await supabase
      .from('obras')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  },
}

// ============================================================
// NOTAS
// ============================================================
export const notasApi = {
  byObra: async (obraId: string): Promise<Nota[]> =>
    unwrap<Nota[]>(
      await supabase
        .from('notas')
        .select('*')
        .eq('obra_id', obraId)
        .order('fecha', { ascending: false }),
    ),

  add: async (n: Nota): Promise<Nota> =>
    unwrap<Nota>(await supabase.from('notas').insert(toDb(n)).select().single()),

  update: async (id: string, patch: Partial<Nota>): Promise<void> => {
    const { error } = await supabase
      .from('notas')
      .update(toDb(patch))
      .eq('id', id)
    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('notas').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// DEADLINES
// ============================================================
export const deadlinesApi = {
  list: async (): Promise<Deadline[]> =>
    unwrap<Deadline[]>(await supabase.from('deadlines').select('*')),

  byObra: async (obraId: string): Promise<Deadline[]> =>
    unwrap<Deadline[]>(
      await supabase
        .from('deadlines')
        .select('*')
        .eq('obra_id', obraId)
        .order('fecha_limite', { ascending: true }),
    ),

  put: async (d: Deadline): Promise<Deadline> =>
    unwrap<Deadline>(
      await supabase.from('deadlines').upsert(toDb(d)).select().single(),
    ),

  update: async (id: string, patch: Partial<Deadline>): Promise<void> => {
    const { error } = await supabase
      .from('deadlines')
      .update(toDb(patch))
      .eq('id', id)
    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('deadlines').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// MATERIALES
// ============================================================
export const materialesApi = {
  byObra: async (obraId: string): Promise<Material[]> =>
    unwrap<Material[]>(
      await supabase.from('materiales').select('*').eq('obra_id', obraId),
    ),

  put: async (m: Material): Promise<Material> =>
    unwrap<Material>(
      await supabase.from('materiales').upsert(toDb(m)).select().single(),
    ),

  update: async (id: string, patch: Partial<Material>): Promise<void> => {
    const { error } = await supabase
      .from('materiales')
      .update(toDb(patch))
      .eq('id', id)
    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('materiales').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// VIATICOS
// ============================================================
export const viaticosApi = {
  list: async (): Promise<Viatico[]> =>
    unwrap<Viatico[]>(await supabase.from('viaticos').select('*')),

  byObra: async (obraId: string): Promise<Viatico[]> =>
    unwrap<Viatico[]>(
      await supabase
        .from('viaticos')
        .select('*')
        .eq('obra_id', obraId)
        .order('fecha', { ascending: false }),
    ),

  put: async (v: Viatico): Promise<Viatico> =>
    unwrap<Viatico>(
      await supabase.from('viaticos').upsert(toDb(v)).select().single(),
    ),

  update: async (id: string, patch: Partial<Viatico>): Promise<void> => {
    const { error } = await supabase
      .from('viaticos')
      .update(toDb(patch))
      .eq('id', id)
    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('viaticos').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// CONTACTOS
// ============================================================
export const contactosApi = {
  list: async (): Promise<Contacto[]> =>
    unwrap<Contacto[]>(
      await supabase.from('contactos').select('*').order('nombre'),
    ),

  put: async (c: Contacto): Promise<Contacto> =>
    unwrap<Contacto>(
      await supabase.from('contactos').upsert(toDb(c)).select().single(),
    ),

  delete: async (id: string): Promise<void> => {
    // CASCADE limpia contacto_obra
    const { error } = await supabase.from('contactos').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// CONTACTO_OBRA (pivot N:N)
// ============================================================
export const contactoObraApi = {
  list: async (): Promise<ContactoObra[]> =>
    unwrap<ContactoObra[]>(await supabase.from('contacto_obra').select('*')),

  link: async (contactoId: string, obraId: string): Promise<void> => {
    const { error } = await supabase
      .from('contacto_obra')
      .upsert(toDb({ contactoId, obraId }))
    if (error) throw error
  },

  unlink: async (contactoId: string, obraId: string): Promise<void> => {
    const { error } = await supabase
      .from('contacto_obra')
      .delete()
      .eq('contacto_id', contactoId)
      .eq('obra_id', obraId)
    if (error) throw error
  },

  exists: async (contactoId: string, obraId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('contacto_obra')
      .select('contacto_id')
      .eq('contacto_id', contactoId)
      .eq('obra_id', obraId)
      .maybeSingle()
    if (error) throw error
    return !!data
  },
}

// ============================================================
// DOCUMENTOS (v2 stub)
// ============================================================
export const documentosApi = {
  byObra: async (obraId: string): Promise<Documento[]> =>
    unwrap<Documento[]>(
      await supabase
        .from('documentos')
        .select('*')
        .eq('obra_id', obraId)
        .order('created_at', { ascending: false }),
    ),
  put: async (d: Documento): Promise<Documento> =>
    unwrap<Documento>(
      await supabase.from('documentos').upsert(toDb(d)).select().single(),
    ),
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('documentos').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// FOTOS (v2 stub)
// ============================================================
export const fotosApi = {
  byObra: async (obraId: string): Promise<Foto[]> =>
    unwrap<Foto[]>(
      await supabase
        .from('fotos')
        .select('*')
        .eq('obra_id', obraId)
        .order('fecha', { ascending: false }),
    ),
  put: async (f: Foto): Promise<Foto> =>
    unwrap<Foto>(await supabase.from('fotos').upsert(toDb(f)).select().single()),
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('fotos').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// MOVIMIENTOS DE PLATA (v2 stub)
// ============================================================
export const plataApi = {
  byObra: async (obraId: string): Promise<MovimientoPlata[]> =>
    unwrap<MovimientoPlata[]>(
      await supabase
        .from('movimientos_plata')
        .select('*')
        .eq('obra_id', obraId)
        .order('fecha', { ascending: false }),
    ),
  put: async (m: MovimientoPlata): Promise<MovimientoPlata> =>
    unwrap<MovimientoPlata>(
      await supabase
        .from('movimientos_plata')
        .upsert(toDb(m))
        .select()
        .single(),
    ),
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('movimientos_plata')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// FOJA (v2 stub)
// ============================================================
export const fojasApi = {
  byObra: async (obraId: string): Promise<FojaPeriodo[]> =>
    unwrap<FojaPeriodo[]>(
      await supabase
        .from('foja_periodos')
        .select('*')
        .eq('obra_id', obraId)
        .order('periodo', { ascending: false }),
    ),
  put: async (p: FojaPeriodo): Promise<FojaPeriodo> =>
    unwrap<FojaPeriodo>(
      await supabase.from('foja_periodos').upsert(toDb(p)).select().single(),
    ),
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('foja_periodos')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

export const fojaItemsApi = {
  byPeriodo: async (fojaPeriodoId: string): Promise<FojaItem[]> =>
    unwrap<FojaItem[]>(
      await supabase
        .from('foja_items')
        .select('*')
        .eq('foja_periodo_id', fojaPeriodoId),
    ),
  put: async (i: FojaItem): Promise<FojaItem> =>
    unwrap<FojaItem>(
      await supabase.from('foja_items').upsert(toDb(i)).select().single(),
    ),
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('foja_items').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// CALENDAR EVENTS
// ============================================================
export const plannerApi = {
  // Week range query: fecha BETWEEN start AND end (inclusive)
  byRange: async (start: string, end: string): Promise<PlannerTarea[]> =>
    unwrap<PlannerTarea[]>(
      await supabase
        .from('planner_tareas')
        .select('*')
        .gte('fecha', start)
        .lte('fecha', end)
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true }),
    ),

  add: async (t: PlannerTarea): Promise<PlannerTarea> => {
    const { data: sess } = await supabase.auth.getSession()
    const payload = { ...t, userId: sess.session?.user?.id ?? null }
    return unwrap<PlannerTarea>(
      await supabase.from('planner_tareas').insert(toDb(payload)).select().single(),
    )
  },

  update: async (id: string, patch: Partial<PlannerTarea>): Promise<void> => {
    const body = { ...patch, updatedAt: new Date().toISOString() }
    const { error } = await supabase
      .from('planner_tareas')
      .update(toDb(body))
      .eq('id', id)
    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('planner_tareas').delete().eq('id', id)
    if (error) throw error
  },
}

export const calendarApi = {
  list: async (): Promise<CalendarEvent[]> =>
    unwrap<CalendarEvent[]>(
      await supabase
        .from('calendar_events')
        .select('*')
        .order('event_date', { ascending: true }),
    ),

  getByDate: async (date: string): Promise<CalendarEvent[]> =>
    unwrap<CalendarEvent[]>(
      await supabase
        .from('calendar_events')
        .select('*')
        .eq('event_date', date)
        .order('event_time', { ascending: true, nullsFirst: true }),
    ),

  put: async (e: CalendarEvent): Promise<CalendarEvent> => {
    // The UI builds events with userId: '' as a placeholder, but the column is
    // a UUID — an empty string throws "invalid input syntax for type uuid" and
    // the event silently falls back to localStorage (so it never syncs to
    // Google). Always stamp the authenticated user's id here.
    const { data: sess } = await supabase.auth.getSession()
    const payload = { ...e, userId: sess.session?.user?.id ?? null }
    return unwrap<CalendarEvent>(
      await supabase.from('calendar_events').upsert(toDb(payload)).select().single(),
    )
  },

  update: async (id: string, patch: Partial<CalendarEvent>): Promise<void> => {
    const { error } = await supabase
      .from('calendar_events')
      .update(toDb(patch))
      .eq('id', id)
    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
