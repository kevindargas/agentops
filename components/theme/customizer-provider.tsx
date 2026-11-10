"use client"

import * as React from "react"

import {
  defaultThemeSettings,
  isDefaultThemeSettings,
  sanitizeThemeSettings,
  THEME_STORAGE_KEY,
  type ThemeSettings,
} from "@/lib/theme-presets"

interface CustomizerContextValue {
  settings: ThemeSettings
  /** False until the persisted settings have been read on the client. */
  hydrated: boolean
  /** True when every setting equals the default. */
  isDefault: boolean
  update: (patch: Partial<ThemeSettings>) => void
  reset: () => void
}

const CustomizerContext = React.createContext<CustomizerContextValue | null>(
  null
)

function readStored(): ThemeSettings | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return raw ? sanitizeThemeSettings(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function applyToDocument(s: ThemeSettings) {
  const h = document.documentElement
  h.dataset.accent = s.accent
  h.dataset.radius = s.radius
  h.dataset.density = s.density
  h.dataset.surface = s.surface
}

// Module-level store so useSyncExternalStore can read it without effects.
let current: ThemeSettings = defaultThemeSettings
let hydrated = false
const listeners = new Set<() => void>()
function emit() {
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  if (!hydrated) {
    hydrated = true
    const stored = readStored()
    if (stored) {
      current = stored
      queueMicrotask(emit)
    }
    // Keep tabs in sync.
    window.addEventListener("storage", onStorage)
  }
  return () => listeners.delete(l)
}
function onStorage(e: StorageEvent) {
  if (e.key !== THEME_STORAGE_KEY) return
  const next = e.newValue
    ? sanitizeThemeSettings(safeParse(e.newValue))
    : defaultThemeSettings
  current = next
  applyToDocument(current)
  emit()
}
function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function CustomizerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = React.useSyncExternalStore(
    subscribe,
    () => current,
    () => defaultThemeSettings
  )
  const isHydrated = React.useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false
  )

  const update = React.useCallback((patch: Partial<ThemeSettings>) => {
    current = { ...current, ...patch }
    applyToDocument(current)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(current))
    } catch {}
    emit()
  }, [])

  const reset = React.useCallback(() => {
    current = defaultThemeSettings
    applyToDocument(current)
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    } catch {}
    emit()
  }, [])

  const value = React.useMemo(
    () => ({
      settings,
      hydrated: isHydrated,
      isDefault: isDefaultThemeSettings(settings),
      update,
      reset,
    }),
    [settings, isHydrated, update, reset]
  )
  return (
    <CustomizerContext.Provider value={value}>
      {children}
    </CustomizerContext.Provider>
  )
}

export function useCustomizer() {
  const ctx = React.useContext(CustomizerContext)
  if (!ctx)
    throw new Error("useCustomizer must be used within CustomizerProvider")
  return ctx
}
