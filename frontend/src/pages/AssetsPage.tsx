import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface AssetRecord {
  id: string
  assetTag: string
  name: string
  status: string
  condition: string
  serialNumber?: string | null
  category?: { name: string } | null
  department?: { name: string } | null
  location?: { name: string } | null
  assignments: Array<{ user: { displayName: string } }>
}

interface Category {
  id: string
  name: string
}

export function AssetsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canManage = user?.permissions.includes('asset.manage') ?? false
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [assetTag, setAssetTag] = useState('')
  const [feedback, setFeedback] = useState('')
  const assets = useQuery({
    queryKey: ['assets'],
    queryFn: () => apiRequest<AssetRecord[]>('/assets'),
  })
  const categories = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => apiRequest<Category[]>('/assets/categories'),
  })
  const createAsset = useMutation({
    mutationFn: () =>
      apiRequest('/assets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          ...(categoryId ? { categoryId } : {}),
          ...(serialNumber ? { serialNumber } : {}),
          ...(assetTag ? { assetTag } : {}),
        }),
      }),
    onSuccess: async () => {
      setName('')
      setCategoryId('')
      setSerialNumber('')
      setAssetTag('')
      setFeedback('')
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (error) => setFeedback(error.message),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createAsset.mutate()
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>IT assets</h1>
          <p className="page-description">
            Track ownership, location, condition, maintenance, and disposal history.
          </p>
        </div>
      </div>
      <div className="workspace-grid">
        {canManage && (
          <section className="panel" aria-labelledby="register-asset-title">
            <div className="panel-heading">
              <div>
                <h2 id="register-asset-title">Register an asset</h2>
                <p className="muted-text">Leave the tag blank to generate a unique tag.</p>
              </div>
            </div>
            <form className="form-stack" onSubmit={submit}>
              <label>
                Asset name
                <input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Asset tag
                <input maxLength={40} value={assetTag} onChange={(event) => setAssetTag(event.target.value)} />
              </label>
              <label>
                Category
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Uncategorized</option>
                  {(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Serial number
                <input maxLength={120} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
              </label>
              {feedback && <p className="form-error" role="alert">{feedback}</p>}
              <button className="primary-button" disabled={createAsset.isPending}>
                {createAsset.isPending ? 'Saving...' : 'Register asset'}
              </button>
            </form>
          </section>
        )}
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Inventory register</h2>
              <p className="muted-text">Assets visible to your account.</p>
            </div>
          </div>
          <QueryNotice loading={assets.isLoading} error={assets.error} />
          {assets.data?.length === 0 && <p className="empty-state">No assets are available in your view.</p>}
          {!!assets.data?.length && (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Asset</th><th>Status</th><th>Condition</th><th>Assigned to</th><th>Location</th></tr></thead>
                <tbody>
                  {assets.data.map((asset) => (
                    <tr key={asset.id}>
                      <td><strong>{asset.assetTag}</strong><span className="cell-secondary">{asset.name}</span></td>
                      <td><span className="status-pill">{asset.status.replaceAll('_', ' ')}</span></td>
                      <td>{asset.condition.replaceAll('_', ' ')}</td>
                      <td>{asset.assignments[0]?.user.displayName ?? 'Unassigned'}</td>
                      <td>{asset.location?.name ?? '-'}</td>
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
