import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getSignedUrl, type Bucket } from '../lib/storage'

/**
 * Fullscreen photo viewer. Opens when `path` is non-null. Loads the signed URL
 * from the given bucket. Closes on backdrop tap, on the close button, or with
 * the Escape key.
 */
export function PhotoViewer({
  bucket,
  path,
  onClose,
}: {
  bucket: Bucket
  path: string | null
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let cancelled = false
    getSignedUrl(bucket, path, 3600).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [bucket, path])

  useEffect(() => {
    if (!path) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [path, onClose])

  if (!path) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        // Allow pinch-zoom inside the viewer if iOS decides to expose it.
        touchAction: 'pinch-zoom',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          border: '1px solid rgba(255,255,255,0.2)',
          cursor: 'pointer',
        }}
      >
        <X size={20} />
      </button>
      {url ? (
        <img
          src={url}
          alt=""
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 4,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        />
      ) : (
        <div style={{ color: '#fff' }}>Cargando…</div>
      )}
    </div>
  )
}
