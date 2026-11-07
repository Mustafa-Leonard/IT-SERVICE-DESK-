let accessToken: string | null = null
let refreshInProgress: Promise<boolean> | null = null

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await request(path, init, true)
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await request(path, {}, true)
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status)
  }
  return response.blob()
}

async function request(
  path: string,
  init: RequestInit,
  mayRefresh: boolean,
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (
    response.status === 401 &&
    mayRefresh &&
    !path.startsWith('/auth/')
  ) {
    const refreshed = await refreshAccessToken()
    if (refreshed) return request(path, init, false)
  }
  return response
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInProgress) {
    refreshInProgress = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          setAccessToken(null)
          return false
        }
        const result = (await response.json()) as { accessToken: string }
        setAccessToken(result.accessToken)
        return true
      })
      .finally(() => {
        refreshInProgress = null
      })
  }
  return refreshInProgress
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[]
      error?: string
    }
    if (Array.isArray(body.message)) return body.message.join(' ')
    return body.message ?? body.error ?? `Request failed (HTTP ${response.status}).`
  } catch {
    return `Request failed (HTTP ${response.status}).`
  }
}
