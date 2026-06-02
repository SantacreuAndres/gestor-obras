import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserFromAuthHeader } from '../_lib/supabase.js'
import { buildAuthUrl, getRedirectUri } from '../_lib/google.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  // The frontend passes the Supabase access token via ?token=... since this is a
  // top-level navigation (cannot send Authorization header). We embed it in OAuth state.
  const token = String(req.query.token ?? '')
  if (!token) {
    res.status(401).json({ error: 'Missing token' })
    return
  }
  const user = await getUserFromAuthHeader(`Bearer ${token}`)
  if (!user) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  const redirectUri = getRedirectUri(req)
  const state = Buffer.from(
    JSON.stringify({ uid: user.id, t: token, ts: Date.now() }),
  ).toString('base64url')
  const url = buildAuthUrl({ redirectUri, state })
  res.setHeader('Cache-Control', 'no-store')
  res.redirect(302, url)
}
