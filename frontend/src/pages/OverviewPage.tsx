import { ArrowUpRight, Boxes, Headset, Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { HealthPanel } from '../components/HealthPanel'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface OverviewReport {
  generatedAt: string
  overdueTickets: number
  openIncidents: number
  openNetworkIncidents: number
  ticketStatuses: Record<string, number>
  assetStatuses: Record<string, number>
  manuallyRecordedNetworkDeviceStatuses: Record<string, number>
}

const areas = [
  { title: 'Service desk', description: 'Tickets, responses, and assignments.', icon: Headset, to: '/tickets' },
  { title: 'Asset lifecycle', description: 'Inventory and employee equipment.', icon: Boxes, to: '/assets' },
  { title: 'Network records', description: 'Inventory and manual status.', icon: Network, to: '/network' },
]

export function OverviewPage() {
  const report = useQuery({
    queryKey: ['reports-overview'],
    queryFn: () => apiRequest<OverviewReport>('/reports/overview'),
  })

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">IT operations</p>
          <h1>Operations overview</h1>
          <p className="page-description">
            Current organization activity, based on saved operational records.
          </p>
        </div>
        <Link className="text-link" to="/reports">
          View reports
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <QueryNotice loading={report.isLoading} error={report.error} />
      {report.data && (
        <section className="summary-grid" aria-label="Current service overview">
          <SummaryCard label="Tickets" value={Object.values(report.data.ticketStatuses).reduce((sum, value) => sum + value, 0)} to="/tickets" />
          <SummaryCard label="Overdue" value={report.data.overdueTickets} to="/reports" />
          <SummaryCard label="Open incidents" value={report.data.openIncidents} to="/reports" />
          <SummaryCard label="Network incidents" value={report.data.openNetworkIncidents} to="/network" />
        </section>
      )}
      <div className="content-grid overview-content">
        <section className="foundation-section" aria-labelledby="areas-title">
          <div className="section-heading">
            <div>
              <h2 id="areas-title">Work areas</h2>
              <p className="muted-text">Choose a workspace to continue.</p>
            </div>
          </div>
          <div className="foundation-grid">
            {areas.map(({ title, description, icon: Icon, to }) => (
              <Link className="panel area-card area-card-link" key={title} to={to}>
                <div className="panel-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.75} /></div>
                <h3>{title}</h3>
                <p className="muted-text">{description}</p>
              </Link>
            ))}
          </div>
        </section>
        <HealthPanel />
      </div>
    </>
  )
}

function SummaryCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link className="panel summary-card" to={to}>
      <span>{label}</span>
      <strong>{value}</strong>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  )
}
