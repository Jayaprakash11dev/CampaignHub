import { useCallback, useRef } from 'react'

// Ignores a second call while the first one is still running.
//
// Disabling a button with `mutation.isPending` isn't enough on its own: a
// fast double click fires both clicks before React re-renders the disabled
// button, which posted the same comment twice. A ref is updated
// immediately, so the second click is dropped.
export function useSingleFlight() {
  const running = useRef(false)
  return useCallback(async (task: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true
    try {
      await task()
    } catch {
      // The mutation keeps the error in its own state for the UI to show.
    } finally {
      running.current = false
    }
  }, [])
}
