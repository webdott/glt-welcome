import { useCallback, useEffect, useState } from 'react'

let storageWorks = true

/**
 * State mirrored to localStorage and kept in sync across tabs. The server and first client render
 * use the fallback; saved data loads right after mount so hydration always matches.
 */
export function useStored<T>(key: string, normalize: (raw: unknown) => T, fallback: () => T) {
  const [state, setState] = useState<T>(fallback)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(key)
        setState(raw ? normalize(JSON.parse(raw)) : fallback())
      } catch {
        storageWorks = false
      }
    }
    load()
    setReady(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) load()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch {
          storageWorks = false
        }
        return value
      })
    },
    [key],
  )

  return [state, update, ready] as const
}

export const storageAvailable = () => storageWorks

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h}h ${m}m` : `${h}h`
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
