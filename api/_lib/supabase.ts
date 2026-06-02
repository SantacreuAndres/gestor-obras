import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export async function getUserFromAuthHeader(
  authHeader: string | undefined,
): Promise<{ id: string; email: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const client = getServiceClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user?.id) return null
  return { id: data.user.id, email: data.user.email ?? '' }
}
