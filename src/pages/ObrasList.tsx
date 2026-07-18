import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Building2,
  MapPin,
  CalendarClock,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import {
  obras as obrasApi,
  deadlines as deadlinesApi,
  viaticos as viaticosApi,
  gastos as gastosApi,
} from '../db/db'
import { useLive } from '../hooks/useLive'
import { ETAPA_LABEL, fmtDate, fmtMoney, diasHasta } from '../lib/format'
import { EmptyState } from '../components/EmptyState'
import { ObraFormModal } from '../components/ObraFormModal'

const ETAPAS = ['anteproyecto', 'proyecto', 'permiso', 'ejecucion', 'terminada'] as const

export function ObrasList() {
  const [filtro, setFiltro] = useState<string>('activas')
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  const obras = useLive('obras', () => obrasApi.list(), []) ?? []
  const deadlines = useLive('deadlines', () => deadlinesApi.list(), []) ?? []
  const viaticos = useLive('viaticos', () => viaticosApi.list(), []) ?? []
  // We fetch all gastos across every obra to feed the "A cobrar" KPI and the
  // /exportar screen. Since gastos live in a single table, one round-trip is
  // enough; the KPI stays fresh via realtime.
  const allGastos = useLive(
    'gastos',
    async () => {
      const perObra = await Promise.all(
        obras.map((o) => gastosApi.byObra(o.id)),
      )
      return perObra.flat()
    },
    [obras.map((o) => o.id).join(',')],
  ) ?? []

  const obrasFiltradas = useMemo(() => {
    if (filtro === 'todas') return obras
    if (filtro === 'activas') return obras.filter((o) => o.estado === 'activa')
    return obras.filter((o) => o.etapa === filtro)
  }, [obras, filtro])

  const deadlinesProximos = useMemo(() => {
    const obrasMap = Object.fromEntries(obras.map((o) => [o.id, o]))
    return deadlines
      .filter((d) => d.estado === 'pendiente' && obrasMap[d.obraId])
      .map((d) => ({ ...d, dias: diasHasta(d.fechaLimite), obra: obrasMap[d.obraId] }))
      .filter((d) => d.dias !== null && d.dias <= 14)
      .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))
      .slice(0, 5)
  }, [deadlines, obras])

  // "A cobrar" = viáticos pendientes de recuperar + todos los gastos propios.
  // Los gastos no tienen estado pendiente/recuperado, así que suman completos.
  const viaticosPendientes = useMemo(
    () => viaticos.filter((v) => v.estado === 'pendiente'),
    [viaticos],
  )
  const aCobrar = useMemo(() => {
    const v = viaticosPendientes.reduce((acc, x) => acc + x.monto, 0)
    const g = allGastos.reduce((acc, x) => acc + x.monto, 0)
    return v + g
  }, [viaticosPendientes, allGastos])
  const aCobrarCount = viaticosPendientes.length + allGastos.length

  const obrasActivas = obras.filter((o) => o.estado === 'activa').length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Obras</div>
          <div className="page-subtitle">
            {obrasActivas} activa{obrasActivas === 1 ? '' : 's'} · {obras.length} total
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNew(true)}
          style={{ display: 'inline-flex' }}
        >
          <Plus size={16} />
          Nueva obra
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Obras activas</div>
          <div className="kpi-value numeric">{obrasActivas}</div>
          <div className="kpi-foot">
            {obras.filter((o) => o.estado === 'pausada').length} pausadas ·{' '}
            {obras.filter((o) => o.estado === 'finalizada').length} terminadas
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Deadlines &lt; 14 días</div>
          <div className="kpi-value numeric">
            {
              deadlines.filter((d) => {
                if (d.estado !== 'pendiente') return false
                const dd = diasHasta(d.fechaLimite)
                return dd !== null && dd <= 14
              }).length
            }
          </div>
          <div className="kpi-foot">
            {
              deadlines.filter((d) => {
                const dd = diasHasta(d.fechaLimite)
                return d.estado === 'pendiente' && dd !== null && dd < 0
              }).length
            }{' '}
            vencidos
          </div>
        </div>
        <div
          className="kpi card-clickable"
          onClick={() => navigate('/exportar')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/exportar')
          }}
          aria-label="Ir a exportar viáticos y gastos"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-label">A cobrar</div>
          <div className="kpi-value numeric">{fmtMoney(aCobrar)}</div>
          <div className="kpi-foot">
            {aCobrarCount} ítem{aCobrarCount === 1 ? '' : 's'} · tocá para exportar
          </div>
        </div>
      </div>

      {deadlinesProximos.length > 0 && (
        <>
          <div className="section-head">
            <span>Próximos deadlines</span>
          </div>
          <div className="list mb-16">
            {deadlinesProximos.map((d) => {
              const vencido = (d.dias ?? 0) < 0
              return (
                <div
                  key={d.id}
                  className="list-row card-clickable"
                  onClick={() => navigate(`/obras/${d.obra.id}/deadlines`)}
                >
                  <div
                    className={
                      'btn-icon ' +
                      (vencido ? 'text-danger' : (d.dias ?? 0) <= 3 ? 'text-warn' : '')
                    }
                  >
                    {vencido ? <AlertTriangle size={18} /> : <CalendarClock size={18} />}
                  </div>
                  <div className="list-row-main">
                    <div className="list-row-title truncate">{d.titulo}</div>
                    <div className="list-row-sub truncate">
                      {d.obra.nombre} · {fmtDate(d.fechaLimite)}
                    </div>
                  </div>
                  <span
                    className={
                      'badge ' +
                      (vencido ? 'badge-danger' : (d.dias ?? 0) <= 3 ? 'badge-warn' : '')
                    }
                  >
                    {vencido
                      ? `${Math.abs(d.dias!)}d vencido`
                      : d.dias === 0
                        ? 'Hoy'
                        : `en ${d.dias}d`}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="filter-bar">
        <button
          className={'chip ' + (filtro === 'activas' ? 'active' : '')}
          onClick={() => setFiltro('activas')}
        >
          Activas
        </button>
        <button
          className={'chip ' + (filtro === 'todas' ? 'active' : '')}
          onClick={() => setFiltro('todas')}
        >
          Todas
        </button>
        {ETAPAS.map((e) => (
          <button
            key={e}
            className={'chip ' + (filtro === e ? 'active' : '')}
            onClick={() => setFiltro(e)}
          >
            {ETAPA_LABEL[e]}
          </button>
        ))}
      </div>

      {obrasFiltradas.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={obras.length === 0 ? 'Todavía no hay obras' : 'Nada con ese filtro'}
          subtitle={
            obras.length === 0
              ? 'Cada obra es un expediente con notas, deadlines, materiales y plata.'
              : undefined
          }
          action={
            obras.length === 0 ? (
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                <Plus size={16} /> Crear primera obra
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid-cards">
          {obrasFiltradas.map((o) => {
            const dCount = deadlines.filter(
              (d) => d.obraId === o.id && d.estado === 'pendiente',
            ).length
            const vCount = viaticos.filter(
              (v) => v.obraId === o.id && v.estado === 'pendiente',
            ).length
            return (
              <div
                key={o.id}
                className="card card-clickable"
                onClick={() => navigate(`/obras/${o.id}`)}
              >
                <div className="card-row">
                  <div className="card-title truncate">{o.nombre}</div>
                  <span className="badge badge-accent">{ETAPA_LABEL[o.etapa]}</span>
                </div>
                {o.comitente && (
                  <div className="text-sm text-soft truncate">{o.comitente}</div>
                )}
                {o.direccion && (
                  <div className="row gap-6 text-sm text-soft">
                    <MapPin size={14} />
                    <span className="truncate">{o.direccion}</span>
                  </div>
                )}
                <div className="row gap-8 text-xs text-muted mt-8">
                  {o.fechaEntregaEstimada && (
                    <span className="row gap-4">
                      <CalendarClock size={12} />
                      Entrega {fmtDate(o.fechaEntregaEstimada)}
                    </span>
                  )}
                  {dCount > 0 && (
                    <span className="badge badge-warn">{dCount} deadlines</span>
                  )}
                  {vCount > 0 && (
                    <span className="badge">
                      <Wallet size={11} /> {vCount} viático{vCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={() => setShowNew(true)} aria-label="Nueva obra">
        <Plus size={24} />
      </button>

      <ObraFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSaved={(id) => navigate(`/obras/${id}`)}
      />
    </div>
  )
}
