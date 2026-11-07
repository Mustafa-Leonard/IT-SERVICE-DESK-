import {
  Activity,
  Bell,
  BookOpenText,
  Boxes,
  ChartNoAxesCombined,
  ChevronRight,
  Headset,
  LayoutDashboard,
  Menu,
  Network,
  X,
  Users,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import './AppShell.css'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  {
    to: '/tickets',
    label: 'Service desk',
    icon: Headset,
    end: false,
    permissions: ['ticket.create', 'ticket.read.own', 'ticket.read.assigned', 'ticket.read.all'],
  },
  {
    to: '/assets',
    label: 'Assets',
    icon: Boxes,
    end: false,
    permissions: ['asset.read.own', 'asset.read', 'asset.manage'],
  },
  { to: '/network', label: 'Network', icon: Network, end: false, permissions: ['network.read'] },
  { to: '/knowledge', label: 'Knowledge', icon: BookOpenText, end: false, permissions: ['knowledge.read', 'knowledge.manage'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, end: false, permissions: ['notification.read.own'] },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined, end: false, permissions: ['report.read'] },
  { to: '/health', label: 'System health', icon: Activity, end: false },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const visibleNavigation = useMemo(
    () => navigation.filter(({ permissions }) =>
      !permissions || permissions.some((permission) => user?.permissions.includes(permission)),
    ),
    [user?.permissions],
  )

  const currentLabel = location.pathname.startsWith('/tickets/')
    ? 'Ticket details'
    : location.pathname === '/admin/dashboard'
      ? 'Administration'
    : location.pathname === '/admin/users'
      ? 'Users'
      : visibleNavigation.find(({ to, end }) =>
        end ? location.pathname === to : location.pathname.startsWith(to),
      )?.label ?? 'Not found'

  async function signOut() {
    setLogoutError('')
    try {
      await logout()
    } catch {
      setLogoutError('Session ended locally, but the server could not confirm sign-out.')
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`} aria-label="Main navigation">
        <Link className="brand" to="/" aria-label="IT Service Desk home">
          <span className="brand-mark" aria-hidden="true">
            <Network size={19} strokeWidth={1.75} />
          </span>
          <span className="brand-name">IT Service Desk</span>
        </Link>
        <button
          className="mobile-sidebar-close"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <nav className="sidebar-nav">
          <p className="nav-group-label">Workspace</p>
          {visibleNavigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                `nav-link${isActive ? ' nav-link-active' : ''}`
              }
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          {user?.roles.includes('super_admin') && (
            <NavLink
              to="/admin/dashboard"
              aria-label="Administration"
              className={({ isActive }) =>
                `nav-link${isActive ? ' nav-link-active' : ''}`
              }
              onClick={() => setMobileNavOpen(false)}
            >
              <Users size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>Administration</span>
            </NavLink>
          )}
          <a className="nav-link" href="/api/docs" aria-label="API documentation">
            <BookOpenText size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>API documentation</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-footer-mark" aria-hidden="true" />
          <span>IT operations</span>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="mobile-nav-toggle"
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="app-navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              {currentLabel !== 'Overview' && (
                <>
                  <Link to="/">Overview</Link>
                  <ChevronRight size={14} aria-hidden="true" />
                </>
              )}
              <span aria-current="page">{currentLabel}</span>
            </nav>
          </div>
          <div className="topbar-user">
            <Link className="topbar-notifications" to="/notifications" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <div className="topbar-identity">
              <span className="topbar-avatar" aria-hidden="true">
                {user?.displayName.trim().slice(0, 1).toUpperCase()}
              </span>
              <span className="topbar-user-name">{user?.displayName}</span>
              {user?.roles[0] && (
                <span className="topbar-role">
                  {user.roles[0].replaceAll('_', ' ')}
                </span>
              )}
            </div>
            <button className="quiet-button" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        {logoutError && <p className="banner-error" role="status">{logoutError}</p>}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
