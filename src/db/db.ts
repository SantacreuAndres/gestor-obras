/**
 * Compat shim: la app antes usaba Dexie y un objeto `db` con sub-tablas
 * (`db.obras`, `db.notas`, etc). Ahora todo va contra Supabase.
 *
 * Re-exportamos los APIs por entidad bajo nombres más cortos para que los
 * imports en componentes queden similares al patrón anterior, pero llamando
 * a las funciones de `api.ts` que hablan con Supabase.
 */

export {
  obrasApi as obras,
  notasApi as notas,
  deadlinesApi as deadlines,
  materialesApi as materiales,
  viaticosApi as viaticos,
  gastosApi as gastos,
  contactosApi as contactos,
  contactoObraApi as contactoObra,
  documentosApi as documentos,
  fotosApi as fotos,
  plataApi as plata,
  fojasApi as fojas,
  fojaItemsApi as fojaItems,
} from './api'

import { obrasApi } from './api'

/**
 * Borra una obra y todo su contenido. Con foreign keys + ON DELETE CASCADE,
 * basta con borrar la fila de `obras`: la DB limpia notas, deadlines,
 * materiales, viaticos, documentos, fotos, contacto_obra, foja_*, plata.
 *
 * Los archivos en Storage NO se borran automáticamente (eso lo hacemos por
 * separado si hace falta — ver removeFromBucket).
 */
export async function deleteObraCompleta(obraId: string): Promise<void> {
  await obrasApi.delete(obraId)
}
