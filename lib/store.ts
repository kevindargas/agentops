import * as React from "react"

/**
 * Minimal external store with optional localStorage persistence.
 * Works with useSyncExternalStore so persisted client state never causes
 * hydration mismatches (server snapshot = initial value).
 */
export function createStore<T extends object>(initial: T, storageKey?: string) {
  let state = initial
  let loaded = !storageKey
  const listeners = new Set<() => void>()

  const emit = () => listeners.forEach((l) => l())

  const load = () => {
    if (loaded || typeof window === "undefined") return
    loaded = true
    try {
      const raw = window.localStorage.getItem(storageKey!)
      if (raw) {
        state = { ...state, ...(JSON.parse(raw) as Partial<T>) }
        queueMicrotask(emit)
      }
    } catch {}
  }

  const subscribe = (l: () => void) => {
    listeners.add(l)
    load()
    return () => listeners.delete(l)
  }

  const set = (patch: Partial<T> | ((prev: T) => T)) => {
    state = typeof patch === "function" ? patch(state) : { ...state, ...patch }
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state))
      } catch {}
    }
    emit()
  }

  const get = () => state

  function use(): T {
    return React.useSyncExternalStore(subscribe, get, () => initial)
  }

  return { subscribe, get, set, use }
}

export function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", cb)
      return () => mql.removeEventListener("change", cb)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
