import { Wallet } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function Plata() {
  return (
    <EmptyState
      icon={Wallet}
      title="Plata — disponible en v2"
      subtitle="Presupuesto, costos, certificaciones (alimentadas por la Foja de medición), pagos a gremios y saldos por obra. Mientras tanto, Materiales suma costos y Viáticos lleva el dinero a recuperar."
    />
  )
}
