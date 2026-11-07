import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PublicHeader } from '../components/PublicHeader'
import { ApiError, apiRequest } from '../services/api'

export function PasswordLinkPage({ activation = false }: { activation?: boolean }) {
  const location = useLocation()
  const token = new URLSearchParams(location.search).get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token) {
      setError('This link does not contain a valid token.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest<void>(
        activation ? '/auth/activation/complete' : '/auth/password-reset/complete',
        {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        },
      )
      setMessage(
        activation
          ? 'Your account is active. You can now sign in.'
          : 'Your password has been updated. You can now sign in.',
      )
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to update your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="password-link-title">
          <p className="eyebrow">Account security</p>
          <h1 id="password-link-title">{activation ? 'Activate your account' : 'Set a new password'}</h1>
          <p className="page-description">Choose a password with at least 14 characters.</p>
          <form className="form-stack" onSubmit={submit}>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={14}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                minLength={14}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="success-message" role="status">{message}</p>}
            <button className="primary-button" disabled={submitting || Boolean(message)}>
              {submitting ? 'Saving...' : activation ? 'Activate account' : 'Update password'}
            </button>
          </form>
          <p className="muted-text auth-note"><Link to="/login">Return to sign in</Link></p>
        </section>
      </main>
    </div>
  )
}
