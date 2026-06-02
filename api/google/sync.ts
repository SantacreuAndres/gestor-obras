import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceClient, getUserFromAuthHeader } from '../_lib/supabase.js'
import {
  deleteEvent,
  insertEvent,
  listEvents,
  patchEvent,
  refreshAccessToken,
} from '../_lib/google.js'
import {
  googleToLocal,
  localToGoogle,
  type LocalEvent,
} from '../_lib/eventMap.js'

interface SyncState {
  user_id: string
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
  sync_token: string | null
  calendar_id: string
}

interface MappingRow {
  user_id: string
  google_event_id: string
  local_id: string | null
  google_etag: string | null
  last_synced_local_updated_at: string | null
  updated_at: string
}

interface SyncResult {
  pushed: { created: number; updated: number; deleted: number }
  pulled: { created: number; updated: number; deleted: number }
  resetSyncToken: boolean
  errors: string[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const result = await syncForUser(user.id)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(result)
  } catch (e) {
    const msg = (e as Error).message
    console.error('sync error', e)
    res.status(500).json({ error: msg })
  }
}

async function syncForUser(userId: string): Promise<SyncResult> {
  const supabase = getServiceClient()
  const { data: stateRow, error: stateErr } = await supabase
    .from('google_sync_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (stateErr) throw stateErr
  if (!stateRow) throw new Error('Google Calendar not connected for this user')
  const state = stateRow as SyncState
  const accessToken = await ensureAccessToken(state)

  const result: SyncResult = {
    pushed: { created: 0, updated: 0, deleted: 0 },
    pulled: { created: 0, updated: 0, deleted: 0 },
    resetSyncToken: false,
    errors: [],
  }

  // Step 1 — Pull from Google first. If we did a push and then immediately listed,
  // we would see our own writes again. By pulling first, we record those Google IDs
  // we already know about (no-ops via etag/updated check).
  try {
    await pullFromGoogle(userId, state, accessToken, result)
  } catch (e) {
    if ((e as Error).message.includes('410')) {
      // syncToken expired — clear and re-pull from scratch next time
      await supabase
        .from('google_sync_state')
        .update({ sync_token: null })
        .eq('user_id', userId)
      result.resetSyncToken = true
      result.errors.push('sync_token_expired_will_reset')
    } else {
      throw e
    }
  }

  // Step 2 — Push local changes to Google
  await pushToGoogle(userId, state, accessToken, result)

  await supabase
    .from('google_sync_state')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: result.errors.length ? result.errors.join('; ') : null,
    })
    .eq('user_id', userId)

  return result
}

async function ensureAccessToken(state: SyncState): Promise<string> {
  const supabase = getServiceClient()
  const expiresAt = state.access_token_expires_at
    ? new Date(state.access_token_expires_at).getTime()
    : 0
  // Refresh if missing or expires in the next 60 seconds
  if (state.access_token && expiresAt > Date.now() + 60_000) {
    return state.access_token
  }
  const tokens = await refreshAccessToken(state.refresh_token)
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await supabase
    .from('google_sync_state')
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: newExpiresAt,
    })
    .eq('user_id', state.user_id)
  state.access_token = tokens.access_token
  state.access_token_expires_at = newExpiresAt
  return tokens.access_token
}

async function pullFromGoogle(
  userId: string,
  state: SyncState,
  accessToken: string,
  result: SyncResult,
): Promise<void> {
  const supabase = getServiceClient()
  let pageToken: string | undefined
  let nextSyncToken: string | undefined
  do {
    const page = await listEvents(accessToken, state.calendar_id, {
      syncToken: state.sync_token ?? undefined,
      pageToken,
      timeMin: state.sync_token
        ? undefined
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    for (const g of page.items) {
      const { data: mapping } = await supabase
        .from('google_event_mapping')
        .select('*')
        .eq('user_id', userId)
        .eq('google_event_id', g.id)
        .maybeSingle()
      if (g.status === 'cancelled') {
        if (mapping?.local_id) {
          await supabase
            .from('calendar_events')
            .delete()
            .eq('id', mapping.local_id)
          result.pulled.deleted++
        }
        await supabase
          .from('google_event_mapping')
          .delete()
          .eq('user_id', userId)
          .eq('google_event_id', g.id)
        continue
      }
      const local = googleToLocal(g, userId)
      if (mapping?.local_id) {
        // Update existing local event
        const { error: updErr } = await supabase
          .from('calendar_events')
          .update({
            title: local.title,
            description: local.description,
            event_date: local.event_date,
            event_time: local.event_time,
            reminder_minutes: local.reminder_minutes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.local_id)
        if (updErr) {
          result.errors.push(`update local ${mapping.local_id}: ${updErr.message}`)
          continue
        }
        await supabase
          .from('google_event_mapping')
          .update({
            google_etag: g.etag ?? null,
            last_synced_local_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('google_event_id', g.id)
        result.pulled.updated++
      } else {
        // Create local event
        const newId = crypto.randomUUID()
        const { error: insErr } = await supabase
          .from('calendar_events')
          .insert({
            id: newId,
            user_id: userId,
            title: local.title,
            description: local.description,
            event_date: local.event_date,
            event_time: local.event_time,
            reminder_minutes: local.reminder_minutes,
          })
        if (insErr) {
          result.errors.push(`create local from google ${g.id}: ${insErr.message}`)
          continue
        }
        await supabase.from('google_event_mapping').insert({
          user_id: userId,
          google_event_id: g.id,
          local_id: newId,
          google_etag: g.etag ?? null,
          last_synced_local_updated_at: new Date().toISOString(),
        })
        result.pulled.created++
      }
    }
    pageToken = page.nextPageToken
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken
  } while (pageToken)

  if (nextSyncToken) {
    await supabase
      .from('google_sync_state')
      .update({ sync_token: nextSyncToken })
      .eq('user_id', userId)
    state.sync_token = nextSyncToken
  }
}

async function pushToGoogle(
  userId: string,
  state: SyncState,
  accessToken: string,
  result: SyncResult,
): Promise<void> {
  const supabase = getServiceClient()
  const { data: localEvents, error: localErr } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
  if (localErr) throw localErr
  const locals = (localEvents ?? []) as LocalEvent[]
  const localById = new Map(locals.map((l) => [l.id, l]))

  const { data: mappingRows, error: mapErr } = await supabase
    .from('google_event_mapping')
    .select('*')
    .eq('user_id', userId)
  if (mapErr) throw mapErr
  const mappings = (mappingRows ?? []) as MappingRow[]
  const mappingByLocalId = new Map(
    mappings.filter((m) => m.local_id).map((m) => [m.local_id!, m]),
  )

  // a) Locals without a Google id → insert
  for (const local of locals) {
    if (mappingByLocalId.has(local.id)) continue
    try {
      const g = await insertEvent(
        accessToken,
        state.calendar_id,
        localToGoogle(local),
      )
      await supabase.from('google_event_mapping').insert({
        user_id: userId,
        google_event_id: g.id,
        local_id: local.id,
        google_etag: g.etag ?? null,
        last_synced_local_updated_at: local.updated_at,
      })
      result.pushed.created++
    } catch (e) {
      result.errors.push(`push insert ${local.id}: ${(e as Error).message}`)
    }
  }

  // b) Locals that were updated after the last push → patch
  for (const mapping of mappings) {
    if (!mapping.local_id) continue
    const local = localById.get(mapping.local_id)
    if (!local) continue
    const localUpdated = new Date(local.updated_at).getTime()
    const lastSynced = mapping.last_synced_local_updated_at
      ? new Date(mapping.last_synced_local_updated_at).getTime()
      : 0
    if (localUpdated <= lastSynced) continue
    try {
      const g = await patchEvent(
        accessToken,
        state.calendar_id,
        mapping.google_event_id,
        localToGoogle(local),
      )
      await supabase
        .from('google_event_mapping')
        .update({
          google_etag: g.etag ?? null,
          last_synced_local_updated_at: local.updated_at,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('google_event_id', mapping.google_event_id)
      result.pushed.updated++
    } catch (e) {
      result.errors.push(`push patch ${mapping.google_event_id}: ${(e as Error).message}`)
    }
  }

  // c) Mappings whose local event no longer exists → delete from Google
  for (const mapping of mappings) {
    if (!mapping.local_id) continue
    if (localById.has(mapping.local_id)) continue
    try {
      await deleteEvent(accessToken, state.calendar_id, mapping.google_event_id)
      await supabase
        .from('google_event_mapping')
        .delete()
        .eq('user_id', userId)
        .eq('google_event_id', mapping.google_event_id)
      result.pushed.deleted++
    } catch (e) {
      result.errors.push(`push delete ${mapping.google_event_id}: ${(e as Error).message}`)
    }
  }
}
