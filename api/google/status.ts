import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceClient, getUserFromAuthHeader } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('google_sync_state')
    .select('connected_at, last_sync_at, last_sync_error, calendar_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    connected: !!data,
    connected_at: data?.connected_at ?? null,
    last_sync_at: data?.last_sync_at ?? null,
    last_sync_error: data?.last_sync_error ?? null,
    calendar_id: data?.calendar_id ?? null,
  })
}
