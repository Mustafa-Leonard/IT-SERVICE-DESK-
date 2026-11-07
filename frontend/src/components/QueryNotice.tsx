import { AlertCircle, LoaderCircle } from 'lucide-react'

export function QueryNotice({
  loading,
  error,
}: {
  loading: boolean
  error: unknown
}) {
  if (loading) {
    return (
      <p className="muted-text query-notice">
        <LoaderCircle size={16} className="spinning" aria-hidden="true" />
        Loading records...
      </p>
    )
  }
  if (error) {
    return (
      <p className="form-error query-notice" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {error instanceof Error ? error.message : 'Unable to load records.'}
      </p>
    )
  }
  return null
}
