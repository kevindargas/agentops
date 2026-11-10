import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  findNavGroup,
  findNavItem,
  flatNavigation,
  goToShortcuts,
  navigation,
  quickCreateItems,
  type NavBadgeKey,
} from "@/config/nav"
import { getNavCounts } from "@/config/nav-counts"

const APP_DIR = join(process.cwd(), "app", "(app)")

function pageFor(href: string) {
  const path = href.split("?")[0]
  return join(APP_DIR, ...path.split("/").filter(Boolean), "page.tsx")
}

describe("navigation", () => {
  const withShortcut = flatNavigation.filter((i) => i.shortcut)

  it("uses a unique second key for every G chord", () => {
    const seen = new Map<string, string>()
    for (const item of withShortcut) {
      const [prefix, key, ...rest] = item.shortcut!.split(" ")
      expect(prefix, item.title).toBe("G")
      expect(rest, item.title).toHaveLength(0)
      expect(key, item.title).toMatch(/^[A-Z]$/)
      const lower = key.toLowerCase()
      expect(
        seen.get(lower),
        `${item.title} and ${seen.get(lower)} both use G ${key}`
      ).toBeUndefined()
      seen.set(lower, item.title)
    }
    expect(Object.keys(goToShortcuts)).toHaveLength(withShortcut.length)
  })

  it("keeps G R for the Review Queue and G Q for Requests", () => {
    expect(goToShortcuts.r?.href).toBe("/agentops/reviews")
    expect(goToShortcuts.q?.href).toBe("/itsm/requests")
  })

  it("does not reuse an href except for the 'All ...' child of a parent", () => {
    const seen = new Map<string, string>()
    for (const group of navigation) {
      for (const item of group.items) {
        expect(seen.has(item.href), item.href).toBe(false)
        seen.set(item.href, item.title)
        for (const child of item.items ?? []) {
          if (child.href === item.href) {
            expect(child.title).toMatch(/^All /)
            continue
          }
          expect(seen.has(child.href), child.href).toBe(false)
          seen.set(child.href, child.title)
        }
      }
    }
  })

  it("points every href (and quick-create item) at a page on disk", () => {
    for (const item of [...flatNavigation, ...quickCreateItems]) {
      expect(item.href.startsWith("/"), item.href).toBe(true)
      expect(existsSync(pageFor(item.href)), `${item.href} has no page`).toBe(
        true
      )
    }
  })

  it("resolves every badge key to a live count", () => {
    const counts = getNavCounts()
    const keys = flatNavigation
      .map((i) => i.badge)
      .filter((b): b is NavBadgeKey => b !== undefined)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(typeof counts[key]).toBe("number")
      expect(counts[key]).toBeGreaterThanOrEqual(0)
    }
  })

  it("finds the owning item and group for a page href", () => {
    expect(findNavItem("/agentops/traces")?.title).toBe("Traces")
    expect(findNavItem("/itsm/incidents?view=major")?.title).toBe(
      "Major incidents"
    )
    expect(findNavGroup("/agentops/prompts")?.label).toBe("Build")
    expect(findNavGroup("/itsm/changes/calendar")?.label).toBe(
      "Service Management"
    )
  })
})
