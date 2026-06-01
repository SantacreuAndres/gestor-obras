import { supabase } from './supabase'
import type {
  Obra,
  Nota,
  Deadline,
  Documento,
  Material,
  Foto,
  Contacto,
  ContactoObra,
  MovimientoPlata,
  Viatico,
  FojaPeriodo,
  FojaItem,
} from '../db/schema'
import {
  obrasApi,
  notasApi,
  deadlinesApi,
  materialesApi,
  viaticosApi,
  contactosApi,
  contactoObraApi,
  documentosApi,
  fotosApi,
  plataApi,
  fojasApi,
  fojaItemsApi,
} from '../db/api'

export const BACKUP_VERSION = 2

/**
 * v2: ya no se incluyen blobs (los archivos viven en Supabase Storage y se
 * sincronizan solos entre dispositivos). El backup es solo metadata.
 */
export interface BackupFile {
  app: 'gestor-obras'
  version: number
  exportedAt: string
  obras: Obra[]
  notas: Nota[]
  deadlines: Deadline[]
  documentos: Documento[]
  materiales: Material[]
  fotos: Foto[]
  contactos: Contacto[]
  contactoObras: ContactoObra[]
  plata: MovimientoPlata[]
  viaticos: Viatico[]
  fojas: FojaPeriodo[]
  fojaItems: FojaItem[]
}

export async function exportAll(): Promise<BackupFile> {
  const [
    obras,
    contactos,
    contactoObras,
    deadlines,
    viaticos,
  ] = await Promise.all([
    obrasApi.list(),
    contactosApi.list(),
    contactoObraApi.list(),
    deadlinesApi.list(),
    viaticosApi.list(),
  ])

  // Para las entidades que cuelgan de obra, hacemos un select global directo
  // (más rápido que iterar por obra). Como hay RLS, solo trae las del usuario.
  const fetchAll = async <T,>(table: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    return (data ?? []) as T[]
  }

  const [
    notasAll,
    materialesAll,
    documentosAll,
    fotosAll,
    plataAll,
    fojasAll,
    fojaItemsAll,
  ] = await Promise.all([
    fetchAll<any>('notas'),
    fetchAll<any>('materiales'),
    fetchAll<any>('documentos'),
    fetchAll<any>('fotos'),
    fetchAll<any>('movimientos_plata'),
    fetchAll<any>('foja_periodos'),
    fetchAll<any>('foja_items'),
  ])

  // Convertir snake_case → camelCase a mano (reusamos la lógica simple)
  const toCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  const remap = <T,>(rows: any[]): T[] =>
    rows.map((r) => {
      const out: any = {}
      for (const [k, v] of Object.entries(r)) out[toCamel(k)] = v
      return out
    })

  return {
    app: 'gestor-obras',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    obras,
    notas: remap<Nota>(notasAll),
    deadlines,
    documentos: remap<Documento>(documentosAll),
    materiales: remap<Material>(materialesAll),
    fotos: remap<Foto>(fotosAll),
    contactos,
    contactoObras,
    plata: remap<MovimientoPlata>(plataAll),
    viaticos,
    fojas: remap<FojaPeriodo>(fojasAll),
    fojaItems: remap<FojaItem>(fojaItemsAll),
  }
}

export function downloadBackup(file: BackupFile) {
  const json = JSON.stringify(file, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const fechaTag = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-')
  const a = document.createElement('a')
  a.href = url
  a.download = `gestor-obras-${fechaTag}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ImportMode = 'replace' | 'merge'

export interface ImportSummary {
  obras: number
  notas: number
  deadlines: number
  documentos: number
  materiales: number
  fotos: number
  contactos: number
  contactoObras: number
  plata: number
  viaticos: number
  fojas: number
  fojaItems: number
}

function validate(file: unknown): asserts file is BackupFile {
  if (!file || typeof file !== 'object') throw new Error('Archivo no válido')
  const f = file as BackupFile
  if (f.app !== 'gestor-obras')
    throw new Error('No es un backup de Gestor de Obras')
  if (typeof f.version !== 'number')
    throw new Error('Falta el campo "version"')
  if (f.version > BACKUP_VERSION)
    throw new Error(
      `Versión más nueva (${f.version}) que la soportada por esta app (${BACKUP_VERSION}). Actualizá la app.`,
    )
}

export async function importAll(
  raw: unknown,
  mode: ImportMode,
): Promise<ImportSummary> {
  validate(raw)
  const file = raw as BackupFile

  if (mode === 'replace') {
    // CASCADE limpia hijos cuando borramos obras + contactos
    await supabase.from('obras').delete().neq('id', '__never__')
    await supabase.from('contactos').delete().neq('id', '__never__')
  }

  const putAll = async <T,>(
    items: T[] | undefined,
    putFn: (item: T) => Promise<unknown>,
  ): Promise<number> => {
    if (!items?.length) return 0
    let n = 0
    for (const it of items) {
      try {
        await putFn(it)
        n++
      } catch (e) {
        console.error('import row failed', it, e)
      }
    }
    return n
  }

  // Orden: contactos antes que materiales (FK proveedor), obras antes que sus hijos
  const cObras = await putAll(file.obras, (o) => obrasApi.put(o as Obra))
  const cContactos = await putAll(file.contactos, (c) =>
    contactosApi.put(c as Contacto),
  )
  const [
    cNotas,
    cDeadlines,
    cMateriales,
    cViaticos,
    cDocumentos,
    cFotos,
    cFojas,
  ] = await Promise.all([
    putAll(file.notas, (n) => notasApi.add(n as Nota)),
    putAll(file.deadlines, (d) => deadlinesApi.put(d as Deadline)),
    putAll(file.materiales, (m) => materialesApi.put(m as Material)),
    putAll(file.viaticos, (v) => viaticosApi.put(v as Viatico)),
    putAll(file.documentos, (d) => documentosApi.put(d as Documento)),
    putAll(file.fotos, (f) => fotosApi.put(f as Foto)),
    putAll(file.fojas, (p) => fojasApi.put(p as FojaPeriodo)),
  ])
  const cFojaItems = await putAll(file.fojaItems, (i) =>
    fojaItemsApi.put(i as FojaItem),
  )
  const cContactoObras = await putAll(
    file.contactoObras,
    async (v) => {
      await contactoObraApi.link(
        (v as ContactoObra).contactoId,
        (v as ContactoObra).obraId,
      )
    },
  )
  const cPlata = await putAll(file.plata, (m) =>
    plataApi.put(m as MovimientoPlata),
  )

  return {
    obras: cObras,
    notas: cNotas,
    deadlines: cDeadlines,
    documentos: cDocumentos,
    materiales: cMateriales,
    fotos: cFotos,
    contactos: cContactos,
    contactoObras: cContactoObras,
    plata: cPlata,
    viaticos: cViaticos,
    fojas: cFojas,
    fojaItems: cFojaItems,
  }
}

export async function wipeAll(): Promise<void> {
  // CASCADE limpia todas las tablas hijas
  await supabase.from('obras').delete().neq('id', '__never__')
  await supabase.from('contactos').delete().neq('id', '__never__')
}
