import { useQuery } from '@tanstack/react-query'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface Report {
  generatedAt: string
  overdueTickets: number
  openIncidents: number
  openNetworkIncidents: number
  ticketStatuses: Record<string, number>
  assetStatuses: Record<string, number>
  manuallyRecordedNetworkDeviceStatuses: Record<string, number>
}

interface SlaReport {
  generatedAt: string
  measure: string
  response: { eligible: number; met: number; missed: number; compliancePercent: number | null }
  resolution: { eligible: number; met: number; missed: number; compliancePercent: number | null }
}

export function ReportsPage() {
  const overview = useQuery({
    queryKey: ['reports-overview'],
    queryFn: () => apiRequest<Report>('/reports/overview'),
  })
  const sla = useQuery({
    queryKey: ['reports-sla'],
    queryFn: () => apiRequest<SlaReport>('/reports/sla'),
  })
  const report = overview.data

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Management</p>
          <h1>Operational reports</h1>
          <p className="page-description">Aggregates are calculated from persisted organization records.</p>
        </div>
      </div>
      <QueryNotice loading={overview.isLoading} error={overview.error} />
      {report && (
        <div className="report-grid">
          <section className="panel metric-card">
            <p className="eyebrow">Tickets overdue</p>
            <strong>{report.overdueTickets}</strong>
            <span>Open response or resolution targets past due</span>
          </section>
          <section className="panel metric-card">
            <p className="eyebrow">Service incidents</p>
            <strong>{report.openIncidents}</strong>
            <span>Current organization-wide incidents</span>
          </section>
          <section className="panel metric-card">
            <p className="eyebrow">Network incidents</p>
            <strong>{report.openNetworkIncidents}</strong>
            <span>Manually reported, unresolved incidents</span>
          </section>
          <section className="panel">
            <h2 className="panel-title">Ticket status</h2>
            <MetricList values={report.ticketStatuses} />
          </section>
          <section className="panel">
            <h2 className="panel-title">Asset lifecycle</h2>
            <MetricList values={report.assetStatuses} />
          </section>
          <section className="panel">
            <h2 className="panel-title">Network device status</h2>
            <p className="muted-text form-help">All values below are manually recorded.</p>
            <MetricList values={report.manuallyRecordedNetworkDeviceStatuses} />
          </section>
          <section className="panel sla-report">
            <h2 className="panel-title">SLA compliance</h2>
            <QueryNotice loading={sla.isLoading} error={sla.error} />
            {sla.data && (
              <>
                <p className="muted-text">{sla.data.measure}</p>
                <div className="sla-columns">
                  <SlaMetric title="Response" data={sla.data.response} />
                  <SlaMetric title="Resolution" data={sla.data.resolution} />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function MetricList({ values }: { values: Record<string, number> }) {
  return (
    <dl className="metric-list">
      {Object.entries(values).map(([label, value]) => (
        <div key={label}><dt>{label.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>
      ))}
      {Object.keys(values).length === 0 && <p className="empty-state">No records yet.</p>}
    </dl>
  )
}

function SlaMetric({
  title,
  data,
}: {
  title: string
  data: { eligible: number; met: number; missed: number; compliancePercent: number | null }
}) {
  return (
    <div className="sla-metric">
      <h3>{title}</h3>
      <strong>{data.compliancePercent === null ? '-' : `${data.compliancePercent}%`}</strong>
      <span>{data.met} met - {data.missed} missed - {data.eligible} completed or overdue</span>
    </div>
  )
}
