import { Activity, CircleAlert, RotateCw } from 'lucide-react'
import { useApiHealth } from '../features/health/useApiHealth'

export function HealthPanel() {
  const health = useApiHealth()

  return (
    <section className="panel health-panel" aria-labelledby="health-panel-title">
      <div className="panel-heading">
        <div className="panel-icon" aria-hidden="true">
          <Activity size={18} strokeWidth={1.75} />
        </div>
        <div>
          <h2 id="health-panel-title">API and database</h2>
          <p className="muted-text">Live readiness check</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void health.refetch()}
          aria-label="Check system health again"
          disabled={health.isFetching}
        >
          <RotateCw
            size={16}
            className={health.isFetching ? 'spinning' : undefined}
            aria-hidden="true"
          />
        </button>
      </div>

      {health.isPending ? (
        <p className="health-message" role="status">
          Checking API and database readiness…
        </p>
      ) : health.isError ? (
        <div className="health-message health-message-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{health.error.message}</span>
        </div>
      ) : (
        <>
          <dl className="health-details">
            <div>
              <dt>API</dt>
              <dd>
                <span className="status-dot status-dot-ok" />
                Available
              </dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>
                <span className="status-dot status-dot-ok" />
                Connected
              </dd>
            </div>
          </dl>
          <p className="checked-at">
            Last checked{' '}
            <time dateTime={health.data.checkedAt}>
              {new Date(health.data.checkedAt).toLocaleString()}
            </time>
          </p>
        </>
      )}
    </section>
  )
}
