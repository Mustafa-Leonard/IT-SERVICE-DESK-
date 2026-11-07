import { Link } from 'react-router-dom'

export function AdminDashboardPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Super Administrator</p>
          <h1>Administration</h1>
          <p className="page-description">
            Manage organization access and review operational health.
          </p>
        </div>
      </div>
      <div className="workspace-grid">
        <section className="panel">
          <h2>People and access</h2>
          <p className="muted-text">
            Invite users, assign organization roles, and deactivate accounts.
          </p>
          <Link className="quiet-button" to="/admin/users">Manage users</Link>
        </section>
        <section className="panel">
          <h2>Operational reports</h2>
          <p className="muted-text">
            Review ticket, incident, asset, network, and SLA records.
          </p>
          <Link className="quiet-button" to="/reports">View reports</Link>
        </section>
        <section className="panel">
          <h2>System health</h2>
          <p className="muted-text">
            Check API and database readiness before investigating workflows.
          </p>
          <Link className="quiet-button" to="/health">Check system health</Link>
        </section>
      </div>
    </>
  )
}
