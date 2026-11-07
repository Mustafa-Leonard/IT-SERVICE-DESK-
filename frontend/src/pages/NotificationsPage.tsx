import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface Notification {
  id: string
  title: string
  body: string
  link?: string | null
  readAt?: string | null
  createdAt: string
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<Notification[]>('/notifications'),
  })
  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAllRead = useMutation({
    mutationFn: () => apiRequest('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Updates</p>
          <h1>Notifications</h1>
          <p className="page-description">Personal in-app updates about your work.</p>
        </div>
        <button
          className="quiet-button"
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || !notifications.data?.some((item) => !item.readAt)}
        >
          <CheckCheck size={16} aria-hidden="true" />
          Mark all read
        </button>
      </div>
      <section className="panel">
        <QueryNotice loading={notifications.isLoading} error={notifications.error} />
        <div className="notification-list">
          {(notifications.data ?? []).map((item) => (
            <article className={`notification-item${item.readAt ? '' : ' notification-unread'}`} key={item.id}>
              <div className="notification-content">
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
                {item.link && <Link className="text-link" to={item.link}>Open related record</Link>}
              </div>
              {!item.readAt && (
                <button className="quiet-button" type="button" onClick={() => markRead.mutate(item.id)} disabled={markRead.isPending}>
                  Mark read
                </button>
              )}
            </article>
          ))}
          {notifications.data?.length === 0 && <p className="empty-state">You are all caught up.</p>}
        </div>
        {markRead.error && <p className="form-error" role="alert">{markRead.error.message}</p>}
        {markAllRead.error && <p className="form-error" role="alert">{markAllRead.error.message}</p>}
      </section>
    </>
  )
}
