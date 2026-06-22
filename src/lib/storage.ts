import { supabase } from './supabase'

export type Bucket = 'comprobantes' | 'fotos' | 'documentos' | 'notas'

/**
 * Sube un archivo al bucket indicado. Convención de path:
 *   <auth.uid()>/<obraId>/<random-id>.<ext>
 *
 * Las policies de RLS sobre storage.objects exigen que el primer segmento del
 * path sea el uid del usuario autenticado, por eso lo armamos así.
 */
export async function uploadToBucket(
  bucket: Bucket,
  obraId: string,
  file: File | Blob,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado — iniciá sesión para subir archivos')

  const guessedName = (file as File).name ?? ''
  const extFromName = guessedName.includes('.')
    ? guessedName.split('.').pop()!.toLowerCase()
    : null
  const extFromMime = ((file as File).type ?? '').split('/')[1]?.toLowerCase() ?? null
  const ext = extFromName || extFromMime || 'bin'

  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const path = `${user.id}/${obraId}/${id}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: (file as File).type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw error
  return path
}

/**
 * Devuelve una URL firmada (válida `expiresInSec` segundos) para leer un
 * archivo privado. Null si no hay path.
 */
export async function getSignedUrl(
  bucket: Bucket,
  path: string | null | undefined,
  expiresInSec = 3600,
): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec)
  if (error) {
    console.error('[storage.getSignedUrl] error', error)
    return null
  }
  return data?.signedUrl ?? null
}

export async function removeFromBucket(
  bucket: Bucket,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) console.error('[storage.removeFromBucket] error', error)
}

/** Descarga un objeto del bucket y lo devuelve como data URL (data:image/...).
 *  Útil para embeberlo directamente en un PDF generado en el cliente. */
export async function getDataUrl(
  bucket: Bucket,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) {
    console.error('[storage.getDataUrl] error', error)
    return null
  }
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string) ?? null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(data)
  })
}
