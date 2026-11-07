import { createContext } from 'react'

export interface AuthUser {
  userId: string
  organizationId: string
  email: string
  displayName: string
  roles: string[]
  permissions: string[]
}

export interface AuthContextValue {
  user: AuthUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
