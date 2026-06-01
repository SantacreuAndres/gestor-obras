import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useObra } from '../ObraDetail'
import {
  ESTADO_OBRA_LABEL,
  ETAPA_LABEL,
  TIPO_OBRA_LABEL,
  fmtDate,
  fmtNumber,
} from '../../lib/format'
import { ObraFormModal } from '../../components/ObraFormModal'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card-row" style={{ alignItems: 'flex-start' }}>
      <span className="text-soft text-sm" style={{ minWidth: 140 }}>
        {label}
      </span>
      <span className="weight-600 text-right" style={{ flex: 1, wordBreak: 'break-word' }}>
        {value || '—'}
      </span>
    </div>
  )
}

export function Datos() {
  const obra = useObra()
  const [editing, setEditing] = useState(false)

  return (
    <>
      <div className="row-between mb-12">
        <h3>Datos generales</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Editar
        </button>
      </div>

      <div className="card">
        <Row label="Nombre" value={obra.nombre} />
        <Row label="Comitente" value={obra.comitente} />
        <Row label="Dirección" value={obra.direccion} />
        <div className="divider" />
        <Row label="Tipo" value={TIPO_OBRA_LABEL[obra.tipo]} />
        <Row label="Etapa" value={ETAPA_LABEL[obra.etapa]} />
        <Row label="Estado" value={ESTADO_OBRA_LABEL[obra.estado]} />
        <Row
          label="Superficie"
          value={obra.superficie ? `${fmtNumber(obra.superficie)} m²` : ''}
        />
        <div className="divider" />
        <Row label="Inicio" value={fmtDate(obra.fechaInicio)} />
        <Row label="Entrega estimada" value={fmtDate(obra.fechaEntregaEstimada)} />
      </div>

      {obra.notas && (
        <>
          <div className="section-head mt-16">
            <span>Notas generales</span>
          </div>
          <div className="card">
            <div style={{ whiteSpace: 'pre-wrap' }}>{obra.notas}</div>
          </div>
        </>
      )}

      <ObraFormModal
        open={editing}
        onClose={() => setEditing(false)}
        obraId={obra.id}
      />
    </>
  )
}
