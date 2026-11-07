import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { QueryNotice } from '../components/QueryNotice'
import { apiRequest } from '../services/api'

interface Article {
  id: string
  title: string
  summary?: string | null
  publishedAt?: string | null
  updatedAt: string
}

interface ArticleDetail extends Article {
  revisions: Array<{ id: string; body: string; createdAt: string }>
}

export function KnowledgePage() {
  const { user } = useAuth()
  const [selectedId, setSelectedId] = useState('')
  const articles = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => apiRequest<Article[]>('/knowledge'),
  })
  const detail = useQuery({
    queryKey: ['knowledge-article', selectedId],
    queryFn: () => apiRequest<ArticleDetail>(`/knowledge/${selectedId}`),
    enabled: Boolean(selectedId),
  })

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Knowledge base</p>
          <h1>Help articles</h1>
          <p className="page-description">Published guidance maintained by your IT team.</p>
        </div>
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Articles</h2><p className="muted-text">Select an article to read.</p></div></div>
          <QueryNotice loading={articles.isLoading} error={articles.error} />
          <div className="article-list">
            {(articles.data ?? []).map((article) => (
              <button
                className={`article-button${article.id === selectedId ? ' article-button-active' : ''}`}
                key={article.id}
                type="button"
                onClick={() => setSelectedId(article.id)}
              >
                <strong>{article.title}</strong>
                <span>{article.summary ?? 'No summary provided.'}</span>
              </button>
            ))}
            {articles.data?.length === 0 && <p className="empty-state">No published articles are available.</p>}
          </div>
          {user?.permissions.includes('knowledge.manage') && (
            <p className="muted-text form-help">Article authoring is available through the protected API.</p>
          )}
        </section>
        <section className="panel article-reader" aria-live="polite">
          {!selectedId && <p className="empty-state">Choose an article from the list.</p>}
          {selectedId && <QueryNotice loading={detail.isLoading} error={detail.error} />}
          {detail.data && (
            <>
              <p className="eyebrow">Help article</p>
              <h2>{detail.data.title}</h2>
              {detail.data.summary && <p className="muted-text">{detail.data.summary}</p>}
              <time className="checked-at">Updated {new Date(detail.data.updatedAt).toLocaleDateString()}</time>
              <div className="article-body">
                {detail.data.revisions[0]?.body ?? 'This article has no content.'}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
