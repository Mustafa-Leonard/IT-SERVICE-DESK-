import { Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import './PublicHeader.css'

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="public-brand" to="/" aria-label="IT Service Desk home">
        <span className="public-brand-mark" aria-hidden="true">
          <Network size={18} strokeWidth={1.75} />
        </span>
        <span>IT Service Desk</span>
      </Link>
      <nav className="public-header-actions" aria-label="Account navigation">
        <Link className="public-sign-in" to="/login">Sign in</Link>
        <Link className="public-request-access" to="/#request-access">
          Request access
        </Link>
      </nav>
    </header>
  )
}
