import { useState, useEffect } from 'react'
import type { BackgroundOption } from '@/types'
import { fetchBackgroundOptions } from '@/services/sheetsService'
import { BACKGROUND_OPTIONS } from '@/constants/backgrounds'

export interface UseBackgroundsReturn {
  backgrounds: BackgroundOption[]
  /** The background marked IsDefault? = YES in the sheet. Falls back to the first entry. */
  defaultBackground: BackgroundOption | null
  isLoading: boolean
  /** Non-null when the sheet fetch failed; the static fallback list is used instead. */
  error: string | null
}

/**
 * Fetches the backgrounds config sheet once on mount.
 * Falls back to the static BACKGROUND_OPTIONS constant if the fetch fails
 * so the app never breaks when the sheet is unreachable.
 */
export function useBackgrounds(): UseBackgroundsReturn {
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([])
  const [defaultBackground, setDefaultBackground] = useState<BackgroundOption | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const { backgrounds: fetched, defaultId } = await fetchBackgroundOptions(controller.signal)
        if (fetched.length === 0) {
          throw new Error('Backgrounds sheet returned no rows')
        }
        const def = (defaultId ? fetched.find(b => b.id === defaultId) : null) ?? fetched[0] ?? null
        setBackgrounds(fetched)
        setDefaultBackground(def)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        // Fall back to static list so the app remains usable
        const fallback = BACKGROUND_OPTIONS
        setBackgrounds(fallback)
        setDefaultBackground(fallback[0] ?? null)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  return { backgrounds, defaultBackground, isLoading, error }
}
