import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceClient, getUserFromAuthHeader } from '../_lib/supabase.js'
import { deleteEvent, refreshAccessToken } from '../_lib/google.js'

// Removes a local event's counterpart from Google Calendar.
//
// Must be called by the client BEFORE it deletes the local row, because the
// google_event_mapping table cascade-deletes with calendar_events on some
// schema versions — once the local row is gone the link to the Google event is
// lost. This endpoint reads the mapping while it still exists, deletes the
// Google event, then removes the mapping. No-op if Google is not connected or
// there is no mapping for the event.
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
  const localId = (req.body?.localId ?? '') as string
  if (!localId) {
    res.status(400).json({ error: 'Missing localId' })
    return
  }
  const supabase = getServiceClient()

  const { data: state } = await supabase
    .from('google_sync_state')
    .select('refresh_token, calendar_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!state) {
    res.status(200).json({ deleted: false, reason: 'not_connected' })
    return
  }

  const { data: mapping } = await supabase
    .from('google_event_mapping')
    .select('google_event_id')
    .eq('user_id', user.id)
    .eq('local_id', localId)
    .maybeSingle()
  if (!mapping) {
    res.status(200).json({ deleted: false, reason: 'no_mapping' })
    return
  }

  try {
    const tokens = await refreshAccessToken(state.refresh_token)
    await deleteEvent(tokens.access_token, state.calendar_id, mapping.google_event_id)
    await supabase
      .from('google_event_mapping')
      .delete()
      .eq('user_id', user.id)
      .eq('google_event_id', mapping.google_event_id)
    res.status(200).json({ deleted: true })
  } catch (e) {
    console.error('delete-event error', e)
    res.status(500).json({ error: (e as Error).message })
  }
}
