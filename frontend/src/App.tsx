import { Route, Routes, Outlet } from 'react-router-dom'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { AppShell } from './layouts/AppShell'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { HealthPage } from './pages/HealthPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OverviewPage } from './pages/OverviewPage'
import { TicketsPage } from './pages/TicketsPage'
import { TicketDetailPage } from './pages/TicketDetailPage'
import { AssetsPage } from './pages/AssetsPage'
import { NetworkPage } from './pages/NetworkPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReportsPage } from './pages/ReportsPage'
import { PasswordLinkPage } from './pages/PasswordLinkPage'
import { UsersPage } from './pages/UsersPage'
import { LandingPage } from './pages/LandingPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<LoginPage administrator />} />
      <Route path="/activate" element={<PasswordLinkPage activation />} />
      <Route path="/reset-password" element={<PasswordLinkPage />} />
      <Route path="/" element={<HomeRoute />}>
        <Route index element={<OverviewPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:ticketId" element={<TicketDetailPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="admin" element={<AdminRoute />}>
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function HomeRoute() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <p className="auth-loading">Loading your workspace...</p>
  if (user) return <AppShell />
  if (location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }
  if (location.pathname === '/') return <LandingPage />
  return <Navigate to="/login" replace state={{ from: location }} />
}

function AdminRoute() {
  const { user, ready } = useAuth()
  if (!ready) return <p className="auth-loading">Loading your workspace...</p>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!user.roles.includes('super_admin')) return <Navigate to="/" replace />
  return <Outlet />
}

export default App
