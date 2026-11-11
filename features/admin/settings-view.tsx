"use client"

import { useSearchParams } from "next/navigation"

import { SettingsForm, type SettingsSection } from "./settings-form"

const validSections = new Set<string>([
  "profile",
  "appearance",
  "notifications",
  "security",
  "platform",
  "danger",
])

/**
 * URL reader for the Settings page: `?section=<id>` or `?tab=<id>` scrolls to
 * that card on load (unknown ids fall back to the profile card). Must sit
 * inside `<Suspense>`. The form re-scrolls when the section changes, so it is
 * not keyed and its local state survives a new deep link.
 */
export function SettingsView() {
  const params = useSearchParams()
  const requested = params.get("section") ?? params.get("tab")
  const initialSection = (
    requested && validSections.has(requested) ? requested : "profile"
  ) as SettingsSection
  return <SettingsForm initialSection={initialSection} />
}
