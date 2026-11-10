/**
 * Theme customizer presets. Each option maps to a data attribute on <html>
 * (data-accent, data-radius, data-density, data-surface) whose CSS lives in
 * app/globals.css. Sidebar variant and light/dark mode are applied by
 * components instead of CSS.
 */

export const accents = [
  {
    id: "neutral",
    label: "Neutral",
    description: "Ink on paper",
    swatch: "oklch(0.215 0.014 265)",
    swatchDark: "oklch(0.92 0.004 262)",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Trustworthy blue",
    swatch: "oklch(0.546 0.245 262.881)",
    swatchDark: "oklch(0.623 0.214 259.815)",
  },
  {
    id: "violet",
    label: "Violet",
    description: "Creative, modern",
    swatch: "oklch(0.541 0.281 293.009)",
    swatchDark: "oklch(0.606 0.25 292.717)",
  },
  {
    id: "emerald",
    label: "Emerald",
    description: "Calm and healthy",
    swatch: "oklch(0.596 0.145 163.225)",
    swatchDark: "oklch(0.696 0.17 162.48)",
  },
  {
    id: "rose",
    label: "Rose",
    description: "Warm and bold",
    swatch: "oklch(0.586 0.253 17.585)",
    swatchDark: "oklch(0.645 0.246 16.439)",
  },
  {
    id: "amber",
    label: "Amber",
    description: "Energetic",
    swatch: "oklch(0.666 0.179 58.318)",
    swatchDark: "oklch(0.769 0.188 70.08)",
  },
  {
    id: "teal",
    label: "Teal",
    description: "Technical, cool",
    swatch: "oklch(0.6 0.118 184.704)",
    swatchDark: "oklch(0.704 0.14 182.503)",
  },
] as const

export const radii = [
  { id: "none", label: "Sharp", value: "0rem" },
  { id: "sm", label: "Subtle", value: "0.375rem" },
  { id: "md", label: "Default", value: "0.625rem" },
  { id: "lg", label: "Soft", value: "0.875rem" },
  { id: "xl", label: "Round", value: "1.25rem" },
] as const

export const densities = [
  { id: "comfortable", label: "Comfortable", description: "Default spacing" },
  {
    id: "compact",
    label: "Compact",
    description: "Tighter spacing, more rows on screen",
  },
] as const

export const sidebarStyles = [
  {
    id: "inset",
    label: "Inset",
    description: "Content floats in a rounded panel",
  },
  {
    id: "sidebar",
    label: "Classic",
    description: "Flush sidebar with a divider",
  },
  { id: "floating", label: "Floating", description: "Detached sidebar card" },
] as const

export const surfaces = [
  { id: "flat", label: "Flat", description: "Hairline borders, no shadows" },
  {
    id: "elevated",
    label: "Elevated",
    description: "Soft shadows on cards and menus",
  },
] as const

export type AccentId = (typeof accents)[number]["id"]
export type RadiusId = (typeof radii)[number]["id"]
export type DensityId = (typeof densities)[number]["id"]
export type SidebarStyleId = (typeof sidebarStyles)[number]["id"]
export type SurfaceId = (typeof surfaces)[number]["id"]

export interface ThemeSettings {
  accent: AccentId
  radius: RadiusId
  density: DensityId
  sidebar: SidebarStyleId
  surface: SurfaceId
}

export const defaultThemeSettings: ThemeSettings = {
  accent: "neutral",
  radius: "md",
  density: "comfortable",
  sidebar: "inset",
  surface: "flat",
}

export const THEME_STORAGE_KEY = "agentops:theme"

export function sameThemeSettings(a: ThemeSettings, b: ThemeSettings) {
  return (
    a.accent === b.accent &&
    a.radius === b.radius &&
    a.density === b.density &&
    a.sidebar === b.sidebar &&
    a.surface === b.surface
  )
}

export function isDefaultThemeSettings(s: ThemeSettings) {
  return sameThemeSettings(s, defaultThemeSettings)
}

const ids = {
  accent: new Set<string>(accents.map((a) => a.id)),
  radius: new Set<string>(radii.map((r) => r.id)),
  density: new Set<string>(densities.map((d) => d.id)),
  sidebar: new Set<string>(sidebarStyles.map((s) => s.id)),
  surface: new Set<string>(surfaces.map((s) => s.id)),
}

/** Drops unknown keys/values from persisted JSON so stale storage never produces junk attributes. */
export function sanitizeThemeSettings(input: unknown): ThemeSettings {
  const out: Record<keyof ThemeSettings, string> = { ...defaultThemeSettings }
  if (!input || typeof input !== "object") return defaultThemeSettings
  const raw = input as Record<string, unknown>
  for (const key of Object.keys(ids) as (keyof ThemeSettings)[]) {
    const v = raw[key]
    if (typeof v === "string" && ids[key].has(v)) out[key] = v
  }
  return out as ThemeSettings
}

/** Named combinations shown as one-click "styles" in the customizer. */
export const stylePresets: {
  id: string
  label: string
  description: string
  settings: ThemeSettings
}[] = [
  {
    id: "nova",
    label: "Nova",
    description: "The shadcn default. Neutral, balanced.",
    settings: {
      accent: "neutral",
      radius: "md",
      density: "comfortable",
      sidebar: "inset",
      surface: "flat",
    },
  },
  {
    id: "console",
    label: "Console",
    description: "Dense, sharp, built for operators.",
    settings: {
      accent: "ocean",
      radius: "sm",
      density: "compact",
      sidebar: "sidebar",
      surface: "flat",
    },
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Violet accent, soft corners, floating nav.",
    settings: {
      accent: "violet",
      radius: "lg",
      density: "comfortable",
      sidebar: "floating",
      surface: "elevated",
    },
  },
  {
    id: "forest",
    label: "Forest",
    description: "Calm emerald, classic sidebar.",
    settings: {
      accent: "emerald",
      radius: "md",
      density: "comfortable",
      sidebar: "sidebar",
      surface: "elevated",
    },
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm amber accents, rounded.",
    settings: {
      accent: "amber",
      radius: "xl",
      density: "comfortable",
      sidebar: "inset",
      surface: "elevated",
    },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Teal accent, compact, elevated.",
    settings: {
      accent: "teal",
      radius: "sm",
      density: "compact",
      sidebar: "inset",
      surface: "elevated",
    },
  },
]

/**
 * Inline script that applies persisted attributes before first paint (no flash).
 * Values are checked against the known ids so a tampered or stale localStorage
 * entry cannot inject arbitrary attribute values.
 */
export const themeInitScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"{}");var ok=${JSON.stringify(
  {
    accent: [...ids.accent],
    radius: [...ids.radius],
    density: [...ids.density],
    surface: [...ids.surface],
  }
)};var h=document.documentElement;for(var k in ok){if(ok[k].indexOf(s[k])>-1)h.setAttribute("data-"+k,s[k]);}}catch(e){}})();`
