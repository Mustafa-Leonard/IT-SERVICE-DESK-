import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext, type AuthUser } from './auth-context'
import { apiRequest, setAccessToken } from '../services/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const queryClient = useQueryClient()

  const loadUser = useCallback(async () => {
    try {
      const session = await apiRequest<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      })
      setAccessToken(session.accessToken)
      setUser(await apiRequest<AuthUser>('/auth/me'))
    } catch {
      setAccessToken(null)
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    // Restore the server-backed session on page load; access tokens remain in memory.
    // eslint-disable-next-line react/set-state-in-effect
    void loadUser()
  }, [loadUser])

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await apiRequest<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setAccessToken(session.accessToken)
      const currentUser = await apiRequest<AuthUser>('/auth/me')
      setUser(currentUser)
      setReady(true)
      queryClient.clear()
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
      setUser(null)
      queryClient.clear()
    }
  }, [queryClient])

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
