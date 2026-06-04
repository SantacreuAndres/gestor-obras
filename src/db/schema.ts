export type EtapaObra =
  | 'anteproyecto'
  | 'proyecto'
  | 'permiso'
  | 'ejecucion'
  | 'terminada'

export type TipoObra = 'nueva' | 'refaccion' | 'ampliacion'

export type EstadoObra = 'activa' | 'pausada' | 'finalizada'

export interface Obra {
  id: string
  nombre: string
  comitente: string
  direccion: string
  tipo: TipoObra
  superficie?: number
  etapa: EtapaObra
  fechaInicio?: string
  fechaEntregaEstimada?: string
  estado: EstadoObra
  notas?: string
  createdAt: string
  updatedAt: string
}

export interface NotaAdjunto {
  id: string
  tipo: 'foto' | 'audio'
  // Storage path in the 'notas' bucket: <userId>/<obraId>/<random>.<ext>
  path: string
  mime?: string
  // Duration in seconds — set only for audio so the UI can show the length
  // without instantiating an <audio> element to probe it.
  duracion?: number
}

export interface Nota {
  id: string
  obraId: string
  fecha: string
  texto: string
  anclada: boolean
  adjuntos?: NotaAdjunto[]
}

export type EstadoDeadline = 'pendiente' | 'cumplido'

export interface Deadline {
  id: string
  obraId: string
  titulo: string
  fechaLimite: string
  descripcion?: string
  estado: EstadoDeadline
  avisar: boolean
}

export type TipoDocumento =
  | 'plano'
  | 'permiso_municipal'
  | 'contrato'
  | 'certificado'
  | 'factura'
  | 'otro'

export type EstadoDocumento = 'recibido' | 'pendiente'

export interface Documento {
  id: string
  obraId: string
  nombre: string
  tipo: TipoDocumento
  link?: string
  /** Path del archivo en el bucket Storage `documentos`. */
  archivoPath?: string
  estado: EstadoDocumento
  createdAt: string
}

export type UnidadMaterial =
  | 'bolsas'
  | 'm2'
  | 'm3'
  | 'kg'
  | 'litros'
  | 'unidades'
  | 'ml'

export interface Material {
  id: string
  obraId: string
  nombre: string
  unidad: UnidadMaterial
  precioUnitario: number
  proveedorId?: string
  estimado: number
  comprado: number
  consumido: number
  pedirManual: boolean
}

export interface Foto {
  id: string
  obraId: string
  /** Path de la foto en el bucket Storage `fotos`. */
  fotoPath: string
  fecha: string
  descripcion?: string
}

export type RolContacto =
  | 'albanil'
  | 'electricista'
  | 'plomero'
  | 'pintor'
  | 'gremio_otro'
  | 'proveedor'
  | 'comitente'

export interface Contacto {
  id: string
  nombre: string
  rol: RolContacto
  telefono?: string
  email?: string
  notas?: string
}

export interface ContactoObra {
  contactoId: string
  obraId: string
}

export type TipoMovimientoPlata =
  | 'presupuesto'
  | 'costo'
  | 'certificacion'
  | 'pago'

export interface MovimientoPlata {
  id: string
  obraId: string
  tipo: TipoMovimientoPlata
  fecha: string
  concepto: string
  monto: number
  contactoId?: string
  fojaPeriodoId?: string
}

export type EstadoViatico = 'pendiente' | 'recuperado'

export interface Viatico {
  id: string
  obraId: string
  fecha: string
  concepto: string
  monto: number
  /** Path del comprobante en el bucket Storage `comprobantes`. */
  comprobantePath?: string
  estado: EstadoViatico
}

export interface FojaPeriodo {
  id: string
  obraId: string
  periodo: string
}

export interface FojaItem {
  id: string
  fojaPeriodoId: string
  obraId: string
  descripcion: string
  unidad: string
  cantidadContratada: number
  medidoPeriodo: number
  acumuladoAnterior: number
}

export type EstadoTarea = 'pendiente' | 'progreso' | 'hecha'

export interface PlannerTarea {
  id: string
  userId?: string | null
  obraId?: string | null
  fecha: string
  hora?: string | null
  // If null and there is a hora, the task is treated as 1 hour long.
  horaFin?: string | null
  titulo: string
  descripcion?: string | null
  estado: EstadoTarea
  // Set when the task has been linked to the bidirectional calendar
  // (calendar_events row id). Null = task only, not on the calendar.
  calendarEventId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CalendarEvent {
  id: string
  userId?: string | null
  title: string
  description?: string
  eventDate: string
  eventTime?: string
  // Optional end time; when absent, sync still falls back to start + 1h.
  eventEndTime?: string
  reminderMinutes?: number
  createdAt: string
  updatedAt: string
}
