import { FolderOpen } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function Documentos() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="Documentos — disponible en v2"
      subtitle="Planos, permisos municipales, contratos, certificados y facturas. Por ahora, podés guardarlos en una carpeta de la Mac vinculada al nombre de la obra."
    />
  )
}
