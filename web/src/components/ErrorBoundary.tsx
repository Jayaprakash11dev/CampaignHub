import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

// Catches errors thrown while rendering, so a bug on one page shows a
// message instead of a blank white screen.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-800">Something went wrong on this page</p>
        <p className="mt-1 text-sm text-red-700">Try again, or go back to the board.</p>
        <div className="mt-4 flex justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md bg-white px-3 py-1.5 font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-100"
          >
            Try again
          </button>
          <a href="/" className="rounded-md px-3 py-1.5 font-medium text-red-700 hover:underline">
            Back to the board
          </a>
        </div>
      </div>
    )
  }
}
