import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface TicketDetail {
  id: string
  ticketNumber: string
  subject: string
  description: string
  status: string
  priority: string
  requester: { id: string; displayName: string }
  assignedTo?: { id: string; displayName: string } | null
  comments: Array<{
    id: string
    body: string
    visibility: string
    createdAt: string
    author: { displayName: string }
  }>
  statusHistory: Array<{
    id: string
    from?: string | null
    to: string
    note?: string | null
    createdAt: string
    actor?: { displayName: string } | null
  }>
}

export function TicketDetailPage() {
  const { ticketId } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [feedback, setFeedback] = useState('')
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => apiRequest<TicketDetail>(`/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
  })
  const addComment = useMutation({
    mutationFn: () =>
      apiRequest(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: comment, visibility: 'PUBLIC' }),
      }),
    onSuccess: async () => {
      setComment('')
      setFeedback('')
      await queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
    onError: (error) => setFeedback(error.message),
  })
  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ])
    },
    onError: (error) => setFeedback(error.message),
  })
  const mayComment = user?.permissions.includes('ticket.comment.public') ?? false
  const mayUpdate = user?.permissions.includes('ticket.update') ?? false

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addComment.mutate()
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Service desk</p>
          <h1>{ticket.data?.ticketNumber ?? 'Ticket details'}</h1>
          <p className="page-description">{ticket.data?.subject}</p>
        </div>
        <Link className="text-link" to="/tickets">Back to tickets</Link>
      </div>
      <QueryNotice loading={ticket.isLoading} error={ticket.error} />
      {ticket.data && (
        <div className="workspace-grid">
          <section className="panel">
            <div className="panel-heading">
              <div><h2>{ticket.data.subject}</h2></div>
              <span className="status-pill">{ticket.data.status.replaceAll('_', ' ')}</span>
            </div>
            <p className="ticket-description">{ticket.data.description}</p>
            <dl className="record-details">
              <div><dt>Requester</dt><dd>{ticket.data.requester.displayName}</dd></div>
              <div><dt>Assignee</dt><dd>{ticket.data.assignedTo?.displayName ?? 'Unassigned'}</dd></div>
              <div><dt>Priority</dt><dd>{ticket.data.priority}</dd></div>
            </dl>
            {mayUpdate && ticket.data.assignedTo?.id === user?.userId && (
              <label className="inline-field">
                Update status
                <select
                  value={ticket.data.status}
                  onChange={(event) => updateStatus.mutate(event.target.value)}
                  disabled={updateStatus.isPending}
                >
                  {['OPEN', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'].map((status) => (
                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
            )}
            {feedback && <p className="form-error" role="alert">{feedback}</p>}
            <h3 className="subheading">Conversation</h3>
            <div className="comment-list">
              {ticket.data.comments.map((item) => (
                <article className="comment-card" key={item.id}>
                  <div className="comment-meta">
                    <strong>{item.author.displayName}</strong>
                    <time>{new Date(item.createdAt).toLocaleString()}</time>
                  </div>
                  <p>{item.body}</p>
                </article>
              ))}
              {ticket.data.comments.length === 0 && <p className="empty-state">No comments yet.</p>}
            </div>
            {mayComment && (
              <form className="form-stack comment-form" onSubmit={submitComment}>
                <label>
                  Add a comment
                  <textarea
                    required
                    minLength={1}
                    maxLength={20_000}
                    rows={3}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
                <button className="primary-button" disabled={addComment.isPending}>
                  {addComment.isPending ? 'Posting...' : 'Post comment'}
                </button>
              </form>
            )}
          </section>
          <section className="panel">
            <h2 className="panel-title">Status history</h2>
            <ol className="timeline">
              {ticket.data.statusHistory.map((item) => (
                <li key={item.id}>
                  <strong>{item.to.replaceAll('_', ' ')}</strong>
                  <span>{item.actor?.displayName ?? 'System'} - {new Date(item.createdAt).toLocaleString()}</span>
                  {item.note && <p>{item.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </>
  )
}
