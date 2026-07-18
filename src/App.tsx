import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ObrasList } from './pages/ObrasList'
import { ObraDetail } from './pages/ObraDetail'
import { Contactos } from './pages/Contactos'
import { Configuracion } from './pages/Configuracion'
import { CalendarPage } from './pages/Calendar'
import { Planner } from './pages/Planner'
import { ExportarGlobal } from './pages/ExportarGlobal'
import { Datos } from './pages/obra/Datos'
import { Notas } from './pages/obra/Notas'
import { Deadlines } from './pages/obra/Deadlines'
import { Materiales } from './pages/obra/Materiales'
import { Viaticos } from './pages/obra/Viaticos'
import { Gastos } from './pages/obra/Gastos'
import { Documentos } from './pages/obra/Documentos'
import { Fotos } from './pages/obra/Fotos'
import { Plata } from './pages/obra/Plata'
import { Medicion } from './pages/obra/Medicion'
import { Login } from './pages/Login'
import { AuthCallback } from './pages/AuthCallback'
import { useAuth } from './lib/auth'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="page text-soft" style={{ padding: 48 }}>
        Cargando…
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/obras" replace />} />
        <Route path="/obras" element={<ObrasList />} />
        <Route path="/obras/:obraId" element={<ObraDetail />}>
          <Route index element={<Navigate to="datos" replace />} />
          <Route path="datos" element={<Datos />} />
          <Route path="notas" element={<Notas />} />
          <Route path="deadlines" element={<Deadlines />} />
          <Route path="materiales" element={<Materiales />} />
          <Route path="viaticos" element={<Viaticos />} />
          <Route path="gastos" element={<Gastos />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="fotos" element={<Fotos />} />
          <Route path="plata" element={<Plata />} />
          <Route path="medicion" element={<Medicion />} />
        </Route>
        <Route path="/exportar" element={<ExportarGlobal />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/contactos" element={<Contactos />} />
        <Route path="/config" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/obras" replace />} />
      </Route>
    </Routes>
  )
}
