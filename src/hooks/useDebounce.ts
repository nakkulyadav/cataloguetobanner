import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of `value` that only updates
 * after `delayMs` milliseconds of inactivity.
 *
 * Used by useProviders to debounce the provider search param
 * and avoid hammering the API on every keystroke.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
