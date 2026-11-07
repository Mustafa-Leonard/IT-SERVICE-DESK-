import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { QueryNotice } from '../components/QueryNotice'
import { apiDownload, apiRequest } from '../services/api'
import './NetworkPage.css'

interface NetworkDevice {
  id: string
  name: string
  type: string
  managementIp?: string | null
  status: string
  statusSource?: 'MANUAL' | 'MONITOR'
  statusUpdatedAt?: string
  location?: { name: string } | null
}

interface Subnet {
  id: string
  name: string
  cidr: string
  gateway?: string | null
  dnsServers: string[]
  addresses: Array<{ id: string; address: string; assignmentType: string }>
}

interface IpAddress {
  id: string
  address: string
  assignmentType: string
  subnet?: { id: string; name: string; cidr: string } | null
  device?: { id: string; name: string; type: string } | null
}

interface Vlan {
  id: string
  vlanId: number
  name: string
  purpose?: string | null
  devices: Array<{ device: Pick<NetworkDevice, 'id' | 'name' | 'type'> }>
  subnets: Array<{ subnet: { id: string; name: string; cidr: string } }>
}

interface Topology {
  devices: NetworkDevice[]
  connections: Array<{
    id: string
    description?: string | null
    deviceA: { id: string; name: string }
    deviceB: { id: string; name: string }
  }>
}

interface NetworkIncident {
  id: string
  title: string
  description: string
  severity: string
  status: string
  createdAt: string
  device?: { id: string; name: string } | null
}

interface NetworkMaintenance {
  id: string
  title: string
  description?: string | null
  status: string
  scheduledAt?: string | null
  completedAt?: string | null
  device?: { id: string; name: string } | null
}

interface DeviceConfiguration {
  id: string
  version?: string | null
  changeDescription: string
  createdAt: string
  backupAttachment?: { id: string; originalName: string } | null
}

interface NetworkDeviceDetail extends NetworkDevice {
  configurations: DeviceConfiguration[]
}

const deviceStatuses = ['UNKNOWN', 'ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE']
const deviceTypes = ['ROUTER', 'SWITCH', 'FIREWALL', 'ACCESS_POINT', 'SERVER', 'PRINTER', 'OTHER']
const assignmentTypes = ['STATIC', 'DHCP', 'RESERVED']
const sections = [
  'Devices',
  'IP address management',
  'VLANs',
  'Topology',
  'Incidents',
  'Maintenance',
  'Configurations',
] as const
type Section = typeof sections[number]

interface NetworkCommand {
  path: string
  method?: 'POST' | 'PATCH'
  body: Record<string, unknown>
}

export function NetworkPage() {
  const { user } = useAuth()
  const [section, setSection] = useState<Section>('Devices')
  const canManage = user?.permissions.includes('network.manage') ?? false

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Network documentation</p>
          <h1>Network operations</h1>
          <p className="page-description">
            Maintain documented infrastructure. Device status is manually recorded; automated monitoring is not enabled.
          </p>
        </div>
      </div>
      <nav className="network-tabs" aria-label="Network sections">
        {sections.map((item) => (
          <button
            key={item}
            className={`network-tab${section === item ? ' network-tab-active' : ''}`}
            type="button"
            aria-current={section === item ? 'page' : undefined}
            onClick={() => setSection(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {section === 'Devices' && <DevicesSection canManage={canManage} />}
      {section === 'IP address management' && <IpamSection canManage={canManage} />}
      {section === 'VLANs' && <VlansSection canManage={canManage} />}
      {section === 'Topology' && <TopologySection canManage={canManage} />}
      {section === 'Incidents' && <IncidentsSection />}
      {section === 'Maintenance' && <MaintenanceSection />}
      {section === 'Configurations' && <ConfigurationsSection canManage={canManage} />}
    </>
  )
}

function useNetworkAction() {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState('')
  const mutation = useMutation({
    mutationFn: ({ path, method = 'POST', body }: NetworkCommand) =>
      apiRequest(path, { method, body: JSON.stringify(body) }),
    onSuccess: async () => {
      setFeedback('Changes saved.')
      await queryClient.invalidateQueries({ queryKey: ['network'] })
    },
    onError: (error) => setFeedback(error.message),
  })

  return { mutation, feedback, clearFeedback: () => setFeedback('') }
}

function DevicesSection({ canManage }: { canManage: boolean }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('SWITCH')
  const [managementIp, setManagementIp] = useState('')
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const devices = useQuery({
    queryKey: ['network', 'devices'],
    queryFn: () => apiRequest<NetworkDevice[]>('/network/devices'),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/devices',
      body: { name, type, ...(managementIp ? { managementIp } : {}) },
    })
  }

  return (
    <div className="workspace-grid network-workspace">
      {canManage && (
        <section className="panel" aria-labelledby="add-device-title">
          <div className="panel-heading">
            <div><h2 id="add-device-title">Document a device</h2><p className="muted-text">Initial status is recorded as unknown.</p></div>
          </div>
          <form className="form-stack" onSubmit={submit}>
            <label>Device name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Device type<select value={type} onChange={(event) => setType(event.target.value)}>{deviceTypes.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
            <label>Management IP<input inputMode="url" value={managementIp} onChange={(event) => setManagementIp(event.target.value)} placeholder="192.0.2.10" /></label>
            {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
            <button className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Add device'}</button>
          </form>
        </section>
      )}
      <section className="panel table-panel">
        <div className="panel-heading">
          <div><h2>Documented devices</h2><p className="muted-text">No simulated monitoring data is shown.</p></div>
        </div>
        <QueryNotice loading={devices.isLoading} error={devices.error} />
        {devices.data?.length === 0 && <p className="empty-state">No network devices are documented.</p>}
        {!!devices.data?.length && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Device</th><th>Type</th><th>Management IP</th><th>Status source</th><th>Recorded status</th></tr></thead>
              <tbody>
                {devices.data.map((device) => (
                  <tr key={device.id}>
                    <td><strong>{device.name}</strong><span className="cell-secondary">{device.location?.name ?? 'No location'}</span></td>
                    <td>{device.type.replaceAll('_', ' ')}</td>
                    <td>{device.managementIp ?? '-'}</td>
                    <td><span className="status-pill">{device.statusSource === 'MONITOR' ? 'Monitor' : 'Manual'}</span></td>
                    <td>
                      {canManage ? (
                        <select
                          aria-label={`Manually recorded status for ${device.name}`}
                          value={device.status}
                          onChange={(event) => {
                            clearFeedback()
                            mutation.mutate({
                              path: `/network/devices/${device.id}/status`,
                              method: 'PATCH',
                              body: { status: event.target.value },
                            })
                          }}
                          disabled={mutation.isPending}
                        >
                          {deviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      ) : device.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {feedback && !canManage && <p className="form-error" role="alert">{feedback}</p>}
      </section>
    </div>
  )
}

function IpamSection({ canManage }: { canManage: boolean }) {
  const [cidr, setCidr] = useState('')
  const [subnetName, setSubnetName] = useState('')
  const [gateway, setGateway] = useState('')
  const [address, setAddress] = useState('')
  const [assignmentType, setAssignmentType] = useState('STATIC')
  const [subnetId, setSubnetId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const subnets = useQuery({
    queryKey: ['network', 'subnets'],
    queryFn: () => apiRequest<Subnet[]>('/network/subnets'),
  })
  const addresses = useQuery({
    queryKey: ['network', 'ip-addresses'],
    queryFn: () => apiRequest<IpAddress[]>('/network/ip-addresses'),
  })
  const devices = useQuery({
    queryKey: ['network', 'devices'],
    queryFn: () => apiRequest<NetworkDevice[]>('/network/devices'),
  })

  function createSubnet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/subnets',
      body: { cidr, name: subnetName, ...(gateway ? { gateway } : {}) },
    })
  }

  function createAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/ip-addresses',
      body: {
        address,
        assignmentType,
        ...(subnetId ? { subnetId } : {}),
        ...(deviceId ? { deviceId } : {}),
      },
    })
  }

  return (
    <div className="network-section-stack">
      {canManage && (
        <div className="workspace-grid network-workspace">
          <FormPanel title="Document a subnet" onSubmit={createSubnet} actionLabel="Add subnet" pending={mutation.isPending}>
            <label>Subnet name<input required minLength={2} maxLength={120} value={subnetName} onChange={(event) => setSubnetName(event.target.value)} /></label>
            <label>CIDR<input required value={cidr} onChange={(event) => setCidr(event.target.value)} placeholder="192.0.2.0/24" /></label>
            <label>Gateway<input inputMode="url" value={gateway} onChange={(event) => setGateway(event.target.value)} placeholder="192.0.2.1" /></label>
            <p className="form-help">The API validates CIDR and verifies the gateway belongs to the subnet.</p>
          </FormPanel>
          <FormPanel title="Register an IP address" onSubmit={createAddress} actionLabel="Register address" pending={mutation.isPending}>
            <label>IP address<input required inputMode="url" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="192.0.2.25" /></label>
            <label>Assignment<select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)}>{assignmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Subnet<select value={subnetId} onChange={(event) => setSubnetId(event.target.value)}><option value="">No subnet</option>{(subnets.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.cidr})</option>)}</select></label>
            <label>Device<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">No device</option>{(devices.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </FormPanel>
        </div>
      )}
      {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
      <div className="workspace-grid network-workspace">
        <DataPanel title="Subnets" loading={subnets.isLoading} error={subnets.error} empty={!subnets.data?.length}>
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Name</th><th>CIDR</th><th>Gateway</th><th>Addresses</th></tr></thead>
            <tbody>{subnets.data?.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.cidr}</td><td>{item.gateway ?? '-'}</td><td>{item.addresses.length}</td></tr>)}</tbody>
          </table></div>
        </DataPanel>
        <DataPanel title="Registered IP addresses" loading={addresses.isLoading} error={addresses.error} empty={!addresses.data?.length}>
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Address</th><th>Assignment</th><th>Subnet</th><th>Device</th></tr></thead>
            <tbody>{addresses.data?.map((item) => <tr key={item.id}><td><strong>{item.address}</strong></td><td>{item.assignmentType}</td><td>{item.subnet?.name ?? '-'}</td><td>{item.device?.name ?? '-'}</td></tr>)}</tbody>
          </table></div>
        </DataPanel>
      </div>
    </div>
  )
}

function VlansSection({ canManage }: { canManage: boolean }) {
  const [vlanId, setVlanId] = useState('')
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [selectedVlan, setSelectedVlan] = useState('')
  const [linkType, setLinkType] = useState<'device' | 'subnet'>('device')
  const [recordId, setRecordId] = useState('')
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const vlans = useQuery({
    queryKey: ['network', 'vlans'],
    queryFn: () => apiRequest<Vlan[]>('/network/vlans'),
  })
  const devices = useQuery({
    queryKey: ['network', 'devices'],
    queryFn: () => apiRequest<NetworkDevice[]>('/network/devices'),
  })
  const subnets = useQuery({
    queryKey: ['network', 'subnets'],
    queryFn: () => apiRequest<Subnet[]>('/network/subnets'),
  })

  function createVlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/vlans',
      body: { vlanId: Number(vlanId), name, ...(purpose ? { purpose } : {}) },
    })
  }

  function linkRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: `/network/vlans/${selectedVlan}/links`,
      body: linkType === 'device' ? { deviceId: recordId } : { subnetId: recordId },
    })
  }

  return (
    <div className="network-section-stack">
      {canManage && (
        <div className="workspace-grid network-workspace">
          <FormPanel title="Create VLAN" onSubmit={createVlan} actionLabel="Add VLAN" pending={mutation.isPending}>
            <label>VLAN ID<input required type="number" min={1} max={4094} value={vlanId} onChange={(event) => setVlanId(event.target.value)} /></label>
            <label>Name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Purpose<input maxLength={500} value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label>
          </FormPanel>
          <FormPanel title="Link a subnet or device" onSubmit={linkRecord} actionLabel="Save link" pending={mutation.isPending} disabled={!selectedVlan || !recordId}>
            <label>VLAN<select required value={selectedVlan} onChange={(event) => { setSelectedVlan(event.target.value); setRecordId('') }}><option value="">Select a VLAN</option>{(vlans.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.vlanId} — {item.name}</option>)}</select></label>
            <label>Record type<select value={linkType} onChange={(event) => { setLinkType(event.target.value as 'device' | 'subnet'); setRecordId('') }}><option value="device">Network device</option><option value="subnet">Subnet</option></select></label>
            <label>{linkType === 'device' ? 'Device' : 'Subnet'}<select required value={recordId} onChange={(event) => setRecordId(event.target.value)}><option value="">Select a record</option>{linkType === 'device' ? (devices.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : (subnets.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.cidr})</option>)}</select></label>
          </FormPanel>
        </div>
      )}
      {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
      <DataPanel title="Documented VLANs" loading={vlans.isLoading} error={vlans.error} empty={!vlans.data?.length}>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>VLAN</th><th>Name</th><th>Purpose</th><th>Linked subnets</th><th>Linked devices</th></tr></thead>
          <tbody>{vlans.data?.map((item) => <tr key={item.id}><td><strong>{item.vlanId}</strong></td><td>{item.name}</td><td>{item.purpose ?? '-'}</td><td>{item.subnets.map(({ subnet }) => subnet.cidr).join(', ') || '-'}</td><td>{item.devices.map(({ device }) => device.name).join(', ') || '-'}</td></tr>)}</tbody>
        </table></div>
      </DataPanel>
    </div>
  )
}

function TopologySection({ canManage }: { canManage: boolean }) {
  const [deviceAId, setDeviceAId] = useState('')
  const [deviceBId, setDeviceBId] = useState('')
  const [description, setDescription] = useState('')
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const topology = useQuery({
    queryKey: ['network', 'topology'],
    queryFn: () => apiRequest<Topology>('/network/topology'),
  })

  function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/connections',
      body: { deviceAId, deviceBId, ...(description ? { description } : {}) },
    })
  }

  return (
    <div className="network-section-stack">
      {canManage && (
        <FormPanel title="Document a connection" onSubmit={createConnection} actionLabel="Save connection" pending={mutation.isPending} disabled={!deviceAId || !deviceBId || deviceAId === deviceBId}>
          <label>First device<select required value={deviceAId} onChange={(event) => setDeviceAId(event.target.value)}><option value="">Select device</option>{(topology.data?.devices ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Second device<select required value={deviceBId} onChange={(event) => setDeviceBId(event.target.value)}><option value="">Select device</option>{(topology.data?.devices ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Description<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Connection details (optional)" /></label>
        </FormPanel>
      )}
      {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
      <div className="content-grid topology-grid">
        {topology.data?.devices.length ? (
          <section className="panel topology-diagram-panel">
            <div className="panel-heading">
              <div>
                <h2>Saved topology</h2>
                <p className="muted-text">Connections shown here are documented records, not live discovery.</p>
              </div>
            </div>
            <TopologyDiagram topology={topology.data} />
          </section>
        ) : null}
        <DataPanel title="Documented devices" loading={topology.isLoading} error={topology.error} empty={!topology.data?.devices.length}>
          <ul className="network-record-list">
            {topology.data?.devices.map((device) => (
              <li key={device.id}><strong>{device.name}</strong><span>{device.type.replaceAll('_', ' ')} · {device.location?.name ?? 'No location'}</span></li>
            ))}
          </ul>
        </DataPanel>
        <DataPanel title="Saved connections" loading={topology.isLoading} error={topology.error} empty={!topology.data?.connections.length}>
          <ul className="network-record-list">
            {topology.data?.connections.map((connection) => (
              <li key={connection.id}><strong>{connection.deviceA.name} to {connection.deviceB.name}</strong><span>{connection.description ?? 'No additional connection details'}</span></li>
            ))}
          </ul>
        </DataPanel>
      </div>
    </div>
  )
}

function TopologyDiagram({ topology }: { topology: Topology }) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(topology.devices.length)))
  const rows = Math.ceil(topology.devices.length / columns)
  const positions = new Map(
    topology.devices.map((device, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      return [
        device.id,
        {
          x: 400 + (column - (columns - 1) / 2) * (640 / columns),
          y: 80 + (row + 1) * (260 / (rows + 1)),
        },
      ] as const
    }),
  )

  return (
    <div className="topology-diagram-scroll">
      <svg
        className="topology-diagram"
        viewBox="0 0 800 400"
        role="img"
        aria-label={`Saved network topology with ${topology.devices.length} devices and ${topology.connections.length} documented connections`}
      >
        {topology.connections.map((connection) => {
          const deviceA = positions.get(connection.deviceA.id)
          const deviceB = positions.get(connection.deviceB.id)
          if (!deviceA || !deviceB) return null
          return (
            <line
              key={connection.id}
              x1={deviceA.x}
              y1={deviceA.y}
              x2={deviceB.x}
              y2={deviceB.y}
              className="topology-edge"
            >
              <title>
                {connection.deviceA.name} to {connection.deviceB.name}
                {connection.description ? `: ${connection.description}` : ''}
              </title>
            </line>
          )
        })}
        {topology.devices.map((device) => {
          const position = positions.get(device.id)
          if (!position) return null
          return (
            <g key={device.id} className="topology-node">
              <circle cx={position.x} cy={position.y} r="30" />
              <text x={position.x} y={position.y + 48} textAnchor="middle">
                {device.name}
              </text>
              <title>
                {device.name} — {device.type.replaceAll('_', ' ')}; status {device.status.toLowerCase()} recorded {device.statusSource === 'MONITOR' ? 'by monitor' : 'manually'}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function IncidentsSection() {
  const { user } = useAuth()
  const canManage = user?.permissions.includes('network.incident.manage') ?? false
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('MEDIUM')
  const [deviceId, setDeviceId] = useState('')
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const incidents = useQuery({
    queryKey: ['network', 'incidents'],
    queryFn: () => apiRequest<NetworkIncident[]>('/network/incidents'),
  })
  const devices = useQuery({
    queryKey: ['network', 'devices'],
    queryFn: () => apiRequest<NetworkDevice[]>('/network/devices'),
  })

  function reportIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/incidents',
      body: { title, description, severity, ...(deviceId ? { deviceId } : {}) },
    })
  }

  function updateIncident(id: string, status: string) {
    clearFeedback()
    mutation.mutate({
      path: `/network/incidents/${id}`,
      method: 'PATCH',
      body: { status },
    })
  }

  return (
    <div className="network-section-stack">
      {canManage && (
        <FormPanel title="Report a network incident" onSubmit={reportIncident} actionLabel="Create incident" pending={mutation.isPending}>
          <label>Title<input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Description<textarea required minLength={5} maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Related device<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">Not device-specific</option>{(devices.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </FormPanel>
      )}
      {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
      <DataPanel title="Network incidents" loading={incidents.isLoading} error={incidents.error} empty={!incidents.data?.length}>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Incident</th><th>Device</th><th>Severity</th><th>Status</th><th>Reported</th></tr></thead>
          <tbody>{incidents.data?.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.title}</strong><span className="cell-secondary">{item.description}</span></td>
              <td>{item.device?.name ?? '-'}</td><td>{item.severity}</td>
              <td>{canManage ? (
                <select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => updateIncident(item.id, event.target.value)} disabled={mutation.isPending}>
                  {incidentTransitions[item.status]?.map((status) => <option key={status} value={status}>{status}</option>) ?? <option value={item.status}>{item.status}</option>}
                </select>
              ) : item.status}</td>
              <td>{new Date(item.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </DataPanel>
    </div>
  )
}

const incidentTransitions: Record<string, string[]> = {
  OPEN: ['OPEN', 'INVESTIGATING', 'RESOLVED'],
  INVESTIGATING: ['INVESTIGATING', 'OPEN', 'RESOLVED'],
  RESOLVED: ['RESOLVED', 'OPEN'],
}

function MaintenanceSection() {
  const { user } = useAuth()
  const canManage = user?.permissions.includes('network.maintenance.manage') ?? false
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const maintenance = useQuery({
    queryKey: ['network', 'maintenance'],
    queryFn: () => apiRequest<NetworkMaintenance[]>('/network/maintenance'),
  })
  const devices = useQuery({
    queryKey: ['network', 'devices'],
    queryFn: () => apiRequest<NetworkDevice[]>('/network/devices'),
  })

  function scheduleMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    mutation.mutate({
      path: '/network/maintenance',
      body: {
        title,
        ...(description ? { description } : {}),
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
        ...(deviceId ? { deviceId } : {}),
      },
    })
  }

  function updateMaintenance(id: string, status: string) {
    clearFeedback()
    mutation.mutate({
      path: `/network/maintenance/${id}`,
      method: 'PATCH',
      body: { status },
    })
  }

  return (
    <div className="network-section-stack">
      {canManage && (
        <FormPanel title="Schedule maintenance" onSubmit={scheduleMaintenance} actionLabel="Schedule maintenance" pending={mutation.isPending}>
          <label>Title<input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Description<textarea maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Scheduled time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
          <label>Related device<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">Not device-specific</option>{(devices.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </FormPanel>
      )}
      {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
      <DataPanel title="Network maintenance" loading={maintenance.isLoading} error={maintenance.error} empty={!maintenance.data?.length}>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Task</th><th>Device</th><th>Scheduled</th><th>Status</th></tr></thead>
          <tbody>{maintenance.data?.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.title}</strong><span className="cell-secondary">{item.description ?? ''}</span></td>
              <td>{item.device?.name ?? '-'}</td>
              <td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Unscheduled'}</td>
              <td>{canManage ? (
                <select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => updateMaintenance(item.id, event.target.value)} disabled={mutation.isPending}>
                  {maintenanceTransitions[item.status]?.map((status) => <option key={status} value={status}>{status}</option>) ?? <option value={item.status}>{item.status}</option>}
                </select>
              ) : item.status}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </DataPanel>
    </div>
  )
}

const maintenanceTransitions: Record<string, string[]> = {
  PLANNED: ['PLANNED', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
}

function ConfigurationsSection({ canManage }: { canManage: boolean }) {
  const [deviceId, setDeviceId] = useState('')
  const [version, setVersion] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupAttachment, setBackupAttachment] = useState<{ id: string; originalName: string } | null>(null)
  const { mutation, feedback, clearFeedback } = useNetworkAction()
  const uploadBackup = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return apiRequest<{ id: string; originalName: string }>('/attachments/network-backup', {
        method: 'POST',
        body,
      })
    },
    onSuccess: (attachment) => setBackupAttachment(attachment),
  })
  const downloadBackup = useMutation({
    mutationFn: async (attachment: { id: string; originalName: string }) => ({
      attachment,
      blob: await apiDownload(`/attachments/${attachment.id}/download`),
    }),
    onSuccess: ({ attachment, blob }) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.originalName
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  })
  const devices = useQuery({
    queryKey: ['network', 'devices'],
    queryFn: () => apiRequest<NetworkDevice[]>('/network/devices'),
  })
  const detail = useQuery({
    queryKey: ['network', 'device', deviceId],
    queryFn: () => apiRequest<NetworkDeviceDetail>(`/network/devices/${deviceId}`),
    enabled: Boolean(deviceId),
  })

  async function recordConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    try {
      await mutation.mutateAsync({
        path: `/network/devices/${deviceId}/configurations`,
        body: {
          changeDescription,
          ...(version ? { version } : {}),
          ...(backupAttachment ? { backupAttachmentId: backupAttachment.id } : {}),
        },
      })
      setBackupAttachment(null)
      setBackupFile(null)
    } catch {
      return
    }
  }

  return (
    <div className="network-section-stack">
      {canManage && (
        <FormPanel title="Record a configuration change" onSubmit={recordConfiguration} actionLabel="Save configuration record" pending={mutation.isPending || uploadBackup.isPending} disabled={!deviceId}>
          <label>Device<select required value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">Select a device</option>{(devices.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Version<input maxLength={80} value={version} onChange={(event) => setVersion(event.target.value)} /></label>
          <label>Change description<textarea required minLength={3} maxLength={2000} rows={4} value={changeDescription} onChange={(event) => setChangeDescription(event.target.value)} /></label>
          <label>Configuration backup<input type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.csv,application/pdf,image/jpeg,image/png,text/plain,text/csv" onChange={(event) => { setBackupFile(event.target.files?.[0] ?? null); setBackupAttachment(null) }} /></label>
          {backupFile && !backupAttachment && <button className="quiet-button" type="button" disabled={uploadBackup.isPending} onClick={() => uploadBackup.mutate(backupFile)}>{uploadBackup.isPending ? 'Uploading...' : 'Upload backup'}</button>}
          {backupAttachment && <p className="success-message" role="status">Uploaded: {backupAttachment.originalName}</p>}
          {uploadBackup.error && <p className="form-error" role="alert">{uploadBackup.error.message}</p>}
          <p className="form-help">Only permitted file types are accepted. The API validates file content, size, access, and storage.</p>
        </FormPanel>
      )}
      {feedback && <p className={mutation.isError ? 'form-error' : 'success-message'} role="status">{feedback}</p>}
      {!deviceId && <p className="muted-text">Select a device to review its saved configuration history.</p>}
      {deviceId && (
        <DataPanel title="Configuration history" loading={detail.isLoading} error={detail.error} empty={!detail.data?.configurations.length}>
          <ul className="network-record-list">
            {detail.data?.configurations.map((item) => (
              <li key={item.id}>
                <strong>{item.version ? `Version ${item.version}` : 'Configuration change'} · {new Date(item.createdAt).toLocaleString()}</strong>
                <span>{item.changeDescription}</span>
                {item.backupAttachment && (
                  <div className="configuration-backup">
                    <span>Backup: {item.backupAttachment.originalName}</span>
                    {canManage && (
                      <button
                        className="quiet-button"
                        type="button"
                        onClick={() => downloadBackup.mutate(item.backupAttachment!)}
                        disabled={downloadBackup.isPending}
                      >
                        {downloadBackup.isPending ? 'Downloading...' : 'Download backup'}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
      {downloadBackup.error && <p className="form-error" role="alert">{downloadBackup.error.message}</p>}
    </div>
  )
}

function FormPanel({
  title,
  children,
  onSubmit,
  actionLabel,
  pending,
  disabled = false,
}: {
  title: string
  children: ReactNode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  actionLabel: string
  pending: boolean
  disabled?: boolean
}) {
  return (
    <section className="panel">
      <div className="panel-heading"><div><h2>{title}</h2></div></div>
      <form className="form-stack" onSubmit={onSubmit}>
        {children}
        <button className="primary-button" disabled={pending || disabled}>{pending ? 'Saving...' : actionLabel}</button>
      </form>
    </section>
  )
}

function DataPanel({
  title,
  loading,
  error,
  empty,
  children,
}: {
  title: string
  loading: boolean
  error: Error | null
  empty: boolean
  children: ReactNode
}) {
  return (
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>{title}</h2></div></div>
      <QueryNotice loading={loading} error={error} />
      {!loading && !error && empty && <p className="empty-state">No records are documented yet.</p>}
      {!loading && !error && !empty && children}
    </section>
  )
}
