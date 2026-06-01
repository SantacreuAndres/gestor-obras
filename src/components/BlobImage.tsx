import { useEffect, useState } from 'react'
import { getSignedUrl, type Bucket } from '../lib/storage'

type Props = {
  bucket: Bucket
  path?: string | null
  alt?: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

/**
 * Imagen cargada desde un bucket privado de Supabase Storage. Usa signed URLs
 * con TTL de 1 hora. Si cambia el `path`, refresca la URL.
 */
export function BlobImage({ bucket, path, alt, className, style, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    getSignedUrl(bucket, path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [bucket, path])

  if (!url) return null
  return (
    <img
      src={url}
      alt={alt ?? ''}
      className={className}
      style={style}
      onClick={onClick}
    />
  )
}
