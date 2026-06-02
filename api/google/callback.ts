import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceClient, getUserFromAuthHeader } from '../_lib/supabase.js'
import { exchangeCode, getRedirectUri } from '../_lib/google.js'

const APP_REDIRECT = '/#/config'

function htmlRedirect(res: VercelResponse, path: string, status: 'ok' | string) {
  const url = `${path}?google=${encodeURIComponent(status)}`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(
    `<!doctype html><html><body><script>location.replace(${JSON.stringify(url)})</script>` +
      `<p>Volviendo a la app… <a href="${url}">click acá si no redirige</a></p></body></html>`,
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const code = String(req.query.code ?? '')
    const stateRaw = String(req.query.state ?? '')
    const err = req.query.error
    if (err) {
      htmlRedirect(res, APP_REDIRECT, `error_${err}`)
      return
    }
    if (!code || !stateRaw) {
      htmlRedirect(res, APP_REDIRECT, 'missing_params')
      return
    }
    let parsed: { uid: string; t: string; ts: number }
    try {
      parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
    } catch {
      htmlRedirect(res, APP_REDIRECT, 'bad_state')
      return
    }
    if (Date.now() - parsed.ts > 10 * 60 * 1000) {
      htmlRedirect(res, APP_REDIRECT, 'state_expired')
      return
    }
    const user = await getUserFromAuthHeader(`Bearer ${parsed.t}`)
    if (!user || user.id !== parsed.uid) {
      htmlRedirect(res, APP_REDIRECT, 'unauthorized')
      return
    }

    const redirectUri = getRedirectUri(req)
    const tokens = await exchangeCode({ code, redirectUri })
    if (!tokens.refresh_token) {
      // Happens when the user previously consented and we did not pass prompt=consent.
      // We did pass it, so this should not occur — but guard anyway.
      htmlRedirect(res, APP_REDIRECT, 'no_refresh_token')
      return
    }
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const supabase = getServiceClient()
    const { error: upsertErr } = await supabase
      .from('google_sync_state')
      .upsert(
        {
          user_id: user.id,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expires_at: expiresAt,
          sync_token: null,
          calendar_id: 'primary',
          connected_at: new Date().toISOString(),
          last_sync_at: null,
          last_sync_error: null,
        },
        { onConflict: 'user_id' },
      )
    if (upsertErr) throw upsertErr
    htmlRedirect(res, APP_REDIRECT, 'connected')
  } catch (e) {
    console.error('google/callback error', e)
    htmlRedirect(res, APP_REDIRECT, 'server_error')
  }
}
