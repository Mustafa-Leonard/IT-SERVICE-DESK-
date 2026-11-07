import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PublicHeader } from '../components/PublicHeader'
import { ApiError, apiRequest } from '../services/api'

export function LoginPage({ administrator = false }: { administrator?: boolean }) {
  const { user, ready, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  if (!ready) return <p className="auth-loading">Checking your session...</p>
  if (user) {
    return (
      <Navigate
        to={administrator && user.roles.includes('super_admin') ? '/admin/dashboard' : '/'}
        replace
      />
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Sign-in failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      await apiRequest('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setInfo('If the account exists, password reset instructions will be sent.')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to request a reset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="login-title">
          <p className="eyebrow">{administrator ? 'System administration' : 'IT operations'}</p>
          <h1 id="login-title">{administrator ? 'Administrator sign in' : 'Welcome back'}</h1>
          <p className="page-description">
            {administrator
              ? 'Sign in with your Super Administrator account.'
              : "Sign in to your organization's service desk."}
          </p>
          <form className="form-stack" onSubmit={resetMode ? requestReset : submit}>
            <label>
              Work email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {!resetMode && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            {info && <p className="success-message" role="status">{info}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Please wait...' : resetMode ? 'Request reset link' : 'Sign in'}
            </button>
          </form>
          <button
            className="link-button"
            type="button"
            onClick={() => {
              setResetMode(!resetMode)
              setError('')
              setInfo('')
            }}
          >
            {resetMode ? 'Back to sign in' : 'Forgot password?'}
          </button>
          <p className="muted-text auth-note">
            Need access? Contact your organization's Super Administrator.
          </p>
        </section>
      </main>
    </div>
  )
}
