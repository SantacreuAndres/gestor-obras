import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceClient, getUserFromAuthHeader } from '../_lib/supabase.js'
import { revokeRefreshToken } from '../_lib/google.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('google_sync_state')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()
  if (data?.refresh_token) {
    try {
      await revokeRefreshToken(data.refresh_token)
    } catch (e) {
      console.warn('revoke failed', e)
    }
  }
  await supabase.from('google_sync_state').delete().eq('user_id', user.id)
  await supabase.from('google_event_mapping').delete().eq('user_id', user.id)
  res.status(200).json({ disconnected: true })
}
