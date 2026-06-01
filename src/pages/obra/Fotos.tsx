import { Camera } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function Fotos() {
  return (
    <EmptyState
      icon={Camera}
      title="Fotos de obra — disponible en v2"
      subtitle="Galería con fecha y descripción por foto. Mientras tanto, se puede adjuntar foto al comprobante de cada viático en su pestaña."
    />
  )
}
