import { useEffect, useState } from 'react'
import type { DependencyList } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Tablas suscribibles por realtime. Si agregás una nueva tabla a la publicación
 * `supabase_realtime` en la DB, agregala también acá.
 */
export type TableName =
  | 'obras'
  | 'notas'
  | 'deadlines'
  | 'materiales'
  | 'viaticos'
  | 'gastos'
  | 'contactos'
  | 'contacto_obra'
  | 'documentos'
  | 'fotos'
  | 'movimientos_plata'
  | 'foja_periodos'
  | 'foja_items'

/**
 * Reemplazo de Dexie's `useLiveQuery`. Corre `fetcher` ahora y cada vez que
 * cualquiera de las `tables` recibe un INSERT/UPDATE/DELETE vía Supabase
 * Realtime. Devuelve `undefined` mientras se carga la primera vez (igual que
 * useLiveQuery).
 */
export function useLive<T>(
  tables: TableName | TableName[],
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await fetcher()
        if (!cancelled) setData(next)
      } catch (err) {
        console.error('[useLive] fetch error', err)
      }
    }

    refresh()

    const tableList = Array.isArray(tables) ? tables : [tables]
    const channelName = `live-${tableList.join('-')}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const channel = supabase.channel(channelName)
    for (const t of tableList) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: t },
        () => {
          refresh()
        },
      )
    }
    channel.subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return data
}
