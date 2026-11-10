import * as React from "react"

/**
 * Minimal external store with optional localStorage persistence.
 * Works with useSyncExternalStore so persisted client state never causes
 * hydration mismatches (server snapshot = initial value).
 */
export function createStore<T extends object>(initial: T, storageKey?: string) {
  let state = initial
  let loaded = !storageKey
  let hydrated = false
  const listeners = new Set<() => void>()

  const emit = () => listeners.forEach((l) => l())

  const load = () => {
    if (loaded || !storageKey || typeof window === "undefined") return
    loaded = true
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        state = { ...state, ...(JSON.parse(raw) as Partial<T>) }
        queueMicrotask(emit)
      }
    } catch {}
  }

  const subscribe = (l: () => void) => {
    listeners.add(l)
    load()
    hydrated = true
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

  /**
   * `false` on the server and during the hydration pass, `true` once a client
   * component has subscribed (which also loads persisted state). Render a
   * skeleton until then so the initial value never flashes before the stored
   * one.
   */
  function useHydrated(): boolean {
    return React.useSyncExternalStore(
      subscribe,
      () => hydrated,
      () => false
    )
  }

  return { subscribe, get, set, use, useHydrated }
}

/**
 * Module-scoped list store for feature components that seed from `lib/data`
 * and mutate a local copy (reviews, approvals, policies, keys, schedules...).
 * Create it once at module scope; every consumer (table, stat cards, sidebar
 * badge) then reads the same list through `use()`, so numbers stay in sync
 * after the user acts. Not persisted: a reload returns to the seed.
 *
 * @example
 * const reviewStore = createListStore(reviewItems, (r) => r.id)
 * const items = reviewStore.use()
 * reviewStore.patch(id, { status: "Approved" })
 *
 * `useHydrated()` is `true` after the first client subscription; use it to
 * hold a skeleton while the seed could still differ from client state.
 */
export function createListStore<T>(
  seed: readonly T[],
  getId: (row: T) => string
) {
  const store = createStore<{ items: T[] }>({ items: [...seed] })
  return {
    use: () => store.use().items,
    useHydrated: store.useHydrated,
    get: () => store.get().items,
    subscribe: store.subscribe,
    set: (items: T[] | ((prev: T[]) => T[])) =>
      store.set((s) => ({
        items: typeof items === "function" ? items(s.items) : items,
      })),
    patch: (id: string, patch: Partial<T> | ((row: T) => T)) =>
      store.set((s) => ({
        items: s.items.map((row) =>
          getId(row) !== id
            ? row
            : typeof patch === "function"
              ? patch(row)
              : { ...row, ...patch }
        ),
      })),
    add: (row: T, position: "start" | "end" = "start") =>
      store.set((s) => ({
        items: position === "start" ? [row, ...s.items] : [...s.items, row],
      })),
    remove: (id: string) =>
      store.set((s) => ({ items: s.items.filter((r) => getId(r) !== id) })),
    reset: () => store.set({ items: [...seed] }),
  }
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
