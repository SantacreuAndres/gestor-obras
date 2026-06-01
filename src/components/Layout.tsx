import { NavLink, Outlet } from 'react-router-dom'
import { Building2, Users, Settings, HardHat } from 'lucide-react'

const NAV = [
  { to: '/obras', label: 'Obras', icon: Building2 },
  { to: '/contactos', label: 'Contactos', icon: Users },
  { to: '/config', label: 'Config', icon: Settings },
]

export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">
            <HardHat size={16} />
          </span>
          Gestor de Obras
        </div>
        <div className="nav-section">Navegación</div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <n.icon size={18} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </aside>

      <main className="main">
        <div className="main-scroll">
          <Outlet />
        </div>
        <nav className="tabbar">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                'tabbar-item' + (isActive ? ' active' : '')
              }
            >
              <n.icon size={22} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  )
}
