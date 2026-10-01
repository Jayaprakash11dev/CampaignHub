import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
      >
        Back to the board
      </Link>
    </div>
  )
}
