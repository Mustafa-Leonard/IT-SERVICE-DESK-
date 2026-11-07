import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Headset,
  Network,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PublicHeader } from '../components/PublicHeader'
import './LandingPage.css'

const capabilities = [
  {
    title: 'Service desk',
    description: 'Capture requests, coordinate support, and keep ticket history together.',
    icon: Headset,
  },
  {
    title: 'Asset lifecycle',
    description: 'Maintain an accountable record of equipment, assignments, and service.',
    icon: Boxes,
  },
  {
    title: 'Network documentation',
    description: 'Keep device, address, subnet, and topology records in one workspace.',
    icon: Network,
  },
]

const steps = [
  {
    title: 'Request support',
    description: 'Employees submit an issue through the service desk.',
  },
  {
    title: 'Coordinate work',
    description: 'IT teams track assignments and record operational changes.',
  },
  {
    title: 'Keep a record',
    description: 'Authorized teams use shared histories for follow-up and reporting.',
  },
]

export function LandingPage() {
  return (
    <div className="landing-page">
      <PublicHeader />
      <main>
        <section className="landing-hero landing-container" aria-labelledby="landing-title">
          <div className="landing-copy">
            <span className="landing-label">IT operations platform</span>
            <h1 id="landing-title">
              One workspace for IT support, assets, and network operations.
            </h1>
            <p className="landing-summary">
              Give internal IT teams a clear place to manage service requests
              and maintain operational records.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-primary-action" to="/login">
                Sign in
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a className="landing-secondary-action" href="#request-access">
                Request access
              </a>
            </div>
            <p className="landing-trust-line">Built for internal IT teams.</p>
          </div>

          <div className="landing-preview">
            <div className="landing-preview-header">
              <div className="landing-preview-mark" aria-hidden="true">
                <ClipboardList size={18} strokeWidth={1.75} />
              </div>
              <div>
                <p className="landing-preview-kicker">Workspace</p>
                <h2>IT operations</h2>
              </div>
            </div>
            <ul className="landing-preview-list">
              {capabilities.map(({ title, description, icon: Icon }) => (
                <li key={title}>
                  <span className="landing-preview-icon" aria-hidden="true">
                    <Icon size={17} strokeWidth={1.75} />
                  </span>
                  <span className="landing-preview-item">
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="landing-preview-note">
              Sign in to view records available to your account.
            </p>
          </div>
        </section>

        <section className="landing-section landing-container" aria-labelledby="capabilities-title">
          <div className="landing-section-heading">
            <p className="landing-section-label">A shared operational view</p>
            <h2 id="capabilities-title">The essentials, connected.</h2>
          </div>
          <div className="landing-capability-grid">
            {capabilities.map(({ title, description, icon: Icon }) => (
              <article className="landing-capability" key={title}>
                <span className="landing-capability-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-container" aria-labelledby="workflow-title">
          <div className="landing-section-heading">
            <p className="landing-section-label">How it works</p>
            <h2 id="workflow-title">A clear path from request to record.</h2>
          </div>
          <ol className="landing-steps">
            {steps.map(({ title, description }, index) => (
              <li key={title}>
                <span className="landing-step-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="landing-access landing-container"
          id="request-access"
          aria-labelledby="access-title"
        >
          <div>
            <p className="landing-section-label">Access</p>
            <h2 id="access-title">Need an account?</h2>
            <p>
              Ask your organization’s Super Administrator to create your
              account. Self-service registration is not available.
            </p>
          </div>
          <Link className="landing-secondary-action" to="/login">
            Go to sign in
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <Link className="landing-footer-brand" to="/">IT Service Desk</Link>
          <nav aria-label="Footer navigation">
            <a href="/api/docs">API documentation</a>
            <Link to="/login">Sign in</Link>
            <a href="#request-access">Request access</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
