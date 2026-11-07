import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface UserRecord {
  id: string
  email: string
  displayName: string
  isActive: boolean
  emailVerifiedAt?: string | null
  roles: Array<{ role: { key: string; name: string } }>
}

interface RoleRecord {
  key: string
  name: string
}

export function UsersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canManageUsers = user?.permissions.includes('user.manage') ?? false
  const canManageRoles = user?.permissions.includes('role.manage') ?? false
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [roleKey, setRoleKey] = useState('employee')
  const [feedback, setFeedback] = useState('')
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<UserRecord[]>('/users'),
  })
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiRequest<RoleRecord[]>('/roles'),
    enabled: canManageRoles,
  })
  const createUser = useMutation({
    mutationFn: () =>
      apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ email, displayName, roleKeys: [roleKey] }),
      }),
    onSuccess: async () => {
      setEmail('')
      setDisplayName('')
      setFeedback('Activation email sent.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => setFeedback(error.message),
  })
  const deactivate = useMutation({
    mutationFn: (id: string) => apiRequest(`/users/${id}/deactivate`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (error) => setFeedback(error.message),
  })
  const resendActivation = useMutation({
    mutationFn: (id: string) => apiRequest(`/users/${id}/activation`, { method: 'POST' }),
    onSuccess: () => setFeedback('Activation email sent.'),
    onError: (error) => setFeedback(error.message),
  })
  const updateRoles = useMutation({
    mutationFn: ({ id, roleKeys }: { id: string; roleKeys: string[] }) =>
      apiRequest(`/users/${id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleKeys }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (error) => setFeedback(error.message),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    createUser.mutate()
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>People and access</h1>
          <p className="page-description">Manage accounts and organization roles. New users receive a one-time activation email.</p>
        </div>
      </div>
      <div className="workspace-grid">
        {canManageUsers && (
          <section className="panel">
            <div className="panel-heading"><div><h2>Invite a user</h2><p className="muted-text">No initial password is created or shared.</p></div></div>
            <form className="form-stack" onSubmit={submit}>
              <label>Display name<input required minLength={2} maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
              <label>Work email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              {canManageRoles && (
                <label>
                  Role
                  <select value={roleKey} onChange={(event) => setRoleKey(event.target.value)}>
                    {(roles.data ?? []).map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                  </select>
                </label>
              )}
              {feedback && <p className={feedback.includes('sent') ? 'success-message' : 'form-error'} role="status">{feedback}</p>}
              <button className="primary-button" disabled={createUser.isPending}>{createUser.isPending ? 'Sending...' : 'Create account'}</button>
            </form>
          </section>
        )}
        <section className="panel table-panel">
          <div className="panel-heading"><div><h2>Organization users</h2><p className="muted-text">Access is enforced by the API.</p></div></div>
          <QueryNotice loading={users.isLoading} error={users.error} />
          {users.data && (
            <div className="user-list">
              {users.data.map((record) => (
                <article className="user-row" key={record.id}>
                  <div className="user-identity">
                    <strong>{record.displayName}</strong>
                    <span>{record.email}</span>
                    <span className="cell-secondary">{record.roles.map(({ role }) => role.name).join(', ') || 'No role'}</span>
                  </div>
                  <span className={`status-pill${record.isActive ? ' status-pill-active' : ''}`}>
                    {record.isActive ? 'Active' : record.emailVerifiedAt ? 'Deactivated' : 'Pending activation'}
                  </span>
                  {canManageRoles && (
                    <label className="role-picker">
                      <span className="visually-hidden">Roles for {record.displayName}</span>
                      <select
                        multiple
                        value={record.roles.map(({ role }) => role.key)}
                        onChange={(event) => {
                          const roleKeys = Array.from(event.target.selectedOptions, (option) => option.value)
                          updateRoles.mutate({ id: record.id, roleKeys })
                        }}
                        disabled={updateRoles.isPending}
                      >
                        {(roles.data ?? []).map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                      </select>
                    </label>
                  )}
                  {canManageUsers && !record.isActive && !record.emailVerifiedAt && (
                    <button className="quiet-button" type="button" onClick={() => resendActivation.mutate(record.id)} disabled={resendActivation.isPending}>Resend activation</button>
                  )}
                  {canManageUsers && record.isActive && record.id !== user?.userId && (
                    <button className="quiet-button danger-button" type="button" onClick={() => deactivate.mutate(record.id)} disabled={deactivate.isPending}>Deactivate</button>
                  )}
                </article>
              ))}
            </div>
          )}
          {feedback && !canManageUsers && <p className="form-error" role="alert">{feedback}</p>}
        </section>
      </div>
    </>
  )
}
