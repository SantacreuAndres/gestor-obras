import { supabase } from './supabase'

export interface GoogleStatus {
  connected: boolean
  connected_at: string | null
  last_sync_at: string | null
  last_sync_error: string | null
  calendar_id: string | null
}

export interface SyncResult {
  pushed: { created: number; updated: number; deleted: number }
  pulled: { created: number; updated: number; deleted: number }
  resetSyncToken: boolean
  errors: string[]
  skipped?: string
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('No active session')
  return { Authorization: `Bearer ${token}` }
}

export async function getStatus(): Promise<GoogleStatus> {
  const r = await fetch('/api/google/status', {
    headers: await authHeaders(),
  })
  if (!r.ok) throw new Error(`Status failed: ${r.status}`)
  return (await r.json()) as GoogleStatus
}

export async function startConnect(): Promise<void> {
  // Force refresh in case the cached access_token has expired — otherwise the
  // server-side getUser(token) check on /api/google/auth would reject it and
  // the user would see the raw 401 JSON.
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
  let token = refreshed?.session?.access_token
  if (refreshErr || !token) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token
  }
  if (!token) throw new Error('No active session — relogueate y volvé a intentar.')
  console.log('[googleSync] starting OAuth with token len', token.length)
  // Top-level navigation: the server cannot read the Authorization header here,
  // so we pass the token via query string. It stays in the URL only until the
  // immediate 302 to Google, where it is replaced by the OAuth state.
  window.location.href = `/api/google/auth?token=${encodeURIComponent(token)}`
}

/**
 * Removes an event from Google Calendar before it is deleted locally.
 * Best-effort and never throws: no-op if Google is not connected. Must run
 * before the local row is deleted so the mapping is still resolvable.
 */
export async function deleteFromGoogle(localId: string): Promise<void> {
  try {
    await fetch('/api/google/delete-event', {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId }),
    })
  } catch (e) {
    console.warn('deleteFromGoogle failed:', e)
  }
}

export async function disconnect(): Promise<void> {
  const r = await fetch('/api/google/disconnect', {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!r.ok) throw new Error(`Disconnect failed: ${r.status}`)
}

export async function syncNow(): Promise<SyncResult> {
  const r = await fetch('/api/google/sync', {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Sync failed: ${r.status} ${t}`)
  }
  return (await r.json()) as SyncResult
}

let inFlight = false
let pending = false

/**
 * Fire-and-forget background sync. Skips silently if Google is not connected,
 * coalesces multiple rapid calls into a single follow-up sync, and never throws.
 * Use after local calendar mutations to push them to Google.
 */
export async function triggerBackgroundSync(): Promise<void> {
  if (inFlight) {
    pending = true
    return
  }
  inFlight = true
  try {
    const status = await getStatus().catch(() => null)
    if (!status?.connected) return
    await syncNow().catch((e) => {
      console.warn('background sync failed:', e)
    })
  } finally {
    inFlight = false
    if (pending) {
      pending = false
      void triggerBackgroundSync()
    }
  }
}
