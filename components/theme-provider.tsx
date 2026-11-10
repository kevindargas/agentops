"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

const TRANSITION_CLASS = "theme-transition"
const TRANSITION_MS = 320

/**
 * Adds `html.theme-transition` for the duration of a light/dark flip so every
 * surface cross-fades together (CSS in globals.css). Safe to call repeatedly.
 * The `D` hotkey that toggles the theme lives in
 * `components/layout/command-menu.tsx` with the other single-key shortcuts.
 */
export function withThemeTransition(apply: () => void) {
  if (typeof document === "undefined") return apply()
  const html = document.documentElement
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  if (reduce) return apply()
  html.classList.add(TRANSITION_CLASS)
  apply()
  window.clearTimeout(timer)
  timer = window.setTimeout(
    () => html.classList.remove(TRANSITION_CLASS),
    TRANSITION_MS
  )
}
let timer = 0

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      {...props}
    >
      <ThemeCrossfade />
      {children}
    </NextThemesProvider>
  )
}

/**
 * Catches theme changes that did not go through withThemeTransition (system
 * preference flips, other tabs via storage). Skips the very first resolution
 * so initial paint never animates.
 */
function ThemeCrossfade() {
  const { resolvedTheme } = useTheme()
  const previous = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (previous.current !== undefined && previous.current !== resolvedTheme) {
      withThemeTransition(() => {})
    }
    previous.current = resolvedTheme
  }, [resolvedTheme])
  return null
}

export { ThemeProvider }
