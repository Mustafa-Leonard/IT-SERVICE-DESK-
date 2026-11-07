import { Link } from 'react-router-dom'
import { HealthPanel } from '../components/HealthPanel'

export function HealthPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>System health</h1>
          <p className="page-description">
            Readiness is checked against the running API and PostgreSQL
            connection.
          </p>
        </div>
        <Link className="text-link" to="/">
          Back to overview
        </Link>
      </div>
      <HealthPanel />
    </>
  )
}
