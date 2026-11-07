import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  updatedAt: string
  requester: { displayName: string }
  assignedTo?: { displayName: string } | null
  category?: { name: string } | null
}

interface TicketCategory {
  id: string
  name: string
}

export function TicketsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canCreateCategory = user?.permissions.includes('system.manage') ?? false
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [formError, setFormError] = useState('')
  const tickets = useQuery({
    queryKey: ['tickets'],
    queryFn: () => apiRequest<Ticket[]>('/tickets'),
  })
  const categories = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: () => apiRequest<TicketCategory[]>('/tickets/categories'),
  })
  const createTicket = useMutation({
    mutationFn: () =>
      apiRequest<Ticket>('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          description,
          ...(categoryId ? { categoryId } : {}),
        }),
      }),
    onSuccess: async () => {
      setSubject('')
      setDescription('')
      setCategoryId('')
      setFormError('')
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (error) => setFormError(error.message),
  })
  const mayCreate = user?.permissions.includes('ticket.create') ?? false

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createTicket.mutate()
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Service desk</p>
          <h1>Support tickets</h1>
          <p className="page-description">
            Track requests, assignments, responses, and resolution history.
          </p>
        </div>
      </div>

      <div className="workspace-grid">
        {mayCreate && (
          <section className="panel" aria-labelledby="new-ticket-title">
            <div className="panel-heading">
              <div>
                <h2 id="new-ticket-title">New request</h2>
                <p className="muted-text">Describe the issue so the IT team can help.</p>
              </div>
            </div>
            <form className="form-stack" onSubmit={submit}>
              <label>
                Subject
                <input
                  required
                  minLength={4}
                  maxLength={200}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label>
                Details
                <textarea
                  required
                  minLength={10}
                  maxLength={20_000}
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <button className="primary-button" disabled={createTicket.isPending}>
                {createTicket.isPending ? 'Submitting...' : 'Submit request'}
              </button>
            </form>
            {canCreateCategory && (
              <p className="muted-text form-help">
                Categories and SLA policies are managed in administration.
              </p>
            )}
          </section>
        )}

        <section className="panel table-panel" aria-labelledby="ticket-list-title">
          <div className="panel-heading">
            <div>
              <h2 id="ticket-list-title">Ticket queue</h2>
              <p className="muted-text">Most recently updated requests.</p>
            </div>
          </div>
          <QueryNotice loading={tickets.isLoading} error={tickets.error} />
          {tickets.data?.length === 0 && (
            <p className="empty-state">No tickets are available in your view.</p>
          )}
          {!!tickets.data?.length && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Request</th><th>Status</th><th>Priority</th><th>Assigned to</th></tr>
                </thead>
                <tbody>
                  {tickets.data.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link className="row-link" to={`/tickets/${ticket.id}`}>
                          <strong>{ticket.ticketNumber}</strong>
                          <span>{ticket.subject}</span>
                        </Link>
                      </td>
                      <td><span className="status-pill">{ticket.status.replaceAll('_', ' ')}</span></td>
                      <td>{ticket.priority}</td>
                      <td>{ticket.assignedTo?.displayName ?? 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
