const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
export const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function getClientId(): string {
  return env('GOOGLE_CLIENT_ID')
}

export function getClientSecret(): string {
  return env('GOOGLE_CLIENT_SECRET')
}

export function getRedirectUri(req: { headers: Record<string, string | string[] | undefined> }): string {
  // Prefer APP_BASE_URL when set; otherwise derive from request host (works for preview URLs)
  const base = process.env.APP_BASE_URL
  if (base) return `${base.replace(/\/$/, '')}/api/google/callback`
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https')
  return `${proto}://${host}/api/google/callback`
}

export function buildAuthUrl(params: {
  redirectUri: string
  state: string
}): string {
  const q = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: CAL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: params.state,
  })
  return `${AUTH_URL}?${q.toString()}`
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCode(params: {
  code: string
  redirectUri: string
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
  })
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Google token exchange failed: ${r.status} ${t}`)
  }
  return (await r.json()) as GoogleTokens
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Google token refresh failed: ${r.status} ${t}`)
  }
  return (await r.json()) as GoogleTokens
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  })
}

export interface GoogleEvent {
  id: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  reminders?: {
    useDefault?: boolean
    overrides?: { method: 'popup' | 'email'; minutes: number }[]
  }
  recurrence?: string[]
  recurringEventId?: string
  updated?: string
  etag?: string
}

const CAL_API = 'https://www.googleapis.com/calendar/v3'

async function callCalendar<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers as Record<string, string> | undefined)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const r = await fetch(`${CAL_API}${path}`, { ...init, headers })
  if (!r.ok) {
    const t = await r.text()
    const err = new Error(`Google Calendar ${init.method ?? 'GET'} ${path} failed: ${r.status} ${t}`)
    ;(err as Error & { status?: number }).status = r.status
    throw err
  }
  if (r.status === 204) return undefined as T
  return (await r.json()) as T
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: Partial<GoogleEvent>,
): Promise<GoogleEvent> {
  return callCalendar<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(event) },
  )
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleEvent>,
): Promise<GoogleEvent> {
  return callCalendar<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(event) },
  )
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await callCalendar<void>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    )
  } catch (e) {
    const status = (e as { status?: number }).status
    // 410 = already deleted; 404 = not found. Both are fine for our purposes.
    if (status !== 410 && status !== 404) throw e
  }
}

export interface ListEventsResult {
  items: GoogleEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  params: {
    syncToken?: string
    pageToken?: string
    timeMin?: string
  } = {},
): Promise<ListEventsResult> {
  const q = new URLSearchParams()
  if (params.syncToken) {
    q.set('syncToken', params.syncToken)
  } else {
    if (params.timeMin) q.set('timeMin', params.timeMin)
    q.set('showDeleted', 'false')
    q.set('singleEvents', 'true')
  }
  if (params.pageToken) q.set('pageToken', params.pageToken)
  q.set('maxResults', '250')
  return callCalendar<ListEventsResult>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${q.toString()}`,
  )
}
