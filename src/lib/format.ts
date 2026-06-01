export function fmtMoney(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

export function fmtNumber(n: number | undefined | null, digits = 2): string {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: digits,
  }).format(n)
}

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function fmtDateLong(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function diasHasta(iso: string | undefined | null): number | null {
  if (!iso) return null
  const target = new Date(iso)
  if (isNaN(target.getTime())) return null
  const now = new Date()
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86400000)
}

export const ETAPA_LABEL: Record<string, string> = {
  anteproyecto: 'Anteproyecto',
  proyecto: 'Proyecto',
  permiso: 'Permiso',
  ejecucion: 'Ejecución',
  terminada: 'Terminada',
}

export const TIPO_OBRA_LABEL: Record<string, string> = {
  nueva: 'Obra nueva',
  refaccion: 'Refacción',
  ampliacion: 'Ampliación',
}

export const ESTADO_OBRA_LABEL: Record<string, string> = {
  activa: 'Activa',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
}

export const ROL_CONTACTO_LABEL: Record<string, string> = {
  albanil: 'Albañil',
  electricista: 'Electricista',
  plomero: 'Plomero',
  pintor: 'Pintor',
  gremio_otro: 'Gremio (otro)',
  proveedor: 'Proveedor',
  comitente: 'Comitente',
}

export const TIPO_DOC_LABEL: Record<string, string> = {
  plano: 'Plano',
  permiso_municipal: 'Permiso municipal',
  contrato: 'Contrato',
  certificado: 'Certificado',
  factura: 'Factura',
  otro: 'Otro',
}

export const UNIDAD_LABEL: Record<string, string> = {
  bolsas: 'bolsas',
  m2: 'm²',
  m3: 'm³',
  kg: 'kg',
  litros: 'litros',
  unidades: 'unidades',
  ml: 'ml',
}
