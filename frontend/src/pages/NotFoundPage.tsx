import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="panel not-found">
      <p className="eyebrow">Page not found</p>
      <h1>This route is not available.</h1>
      <Link className="text-link" to="/">
        Return to overview
      </Link>
    </section>
  )
}
