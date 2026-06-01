import { ClipboardList } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function Medicion() {
  return (
    <EmptyState
      icon={ClipboardList}
      title="Foja de medición — disponible en v2"
      subtitle="Avance por rubro y período: cantidad contratada, medido en este período, acumulado, % de avance. El total alimenta las certificaciones de la sección Plata."
    />
  )
}
