import {
  apiKeys,
  providers,
  rateLimits,
  routingRules,
} from "@/lib/data/providers"
import { createListStore } from "@/lib/store"

/**
 * Module-scope client stores for the gateway page. The provider cards, the
 * keys table, the routing cards, the quotas table, the stat cards and the tab
 * counts all read the same lists, so a rotated key or a paused rule moves
 * every number on the page. Not persisted: a reload returns to the seed.
 */
export const providerStore = createListStore(providers, (p) => p.id)
export const keyStore = createListStore(apiKeys, (k) => k.id)
export const routingStore = createListStore(routingRules, (r) => r.id)
export const rateLimitStore = createListStore(rateLimits, (l) => l.id)

/** Days ahead that count as "expiring soon" on the stat card and in the table. */
export const KEY_EXPIRY_WARNING_DAYS = 14

/** Deterministic hex derived from a string so a demo secret is stable. */
export function fakeHex(input: string, length: number) {
  let h = 2166136261
  let out = ""
  for (let i = 0; out.length < length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i % input.length), 16777619) >>> 0
    out += h.toString(16).padStart(8, "0")
  }
  return out.slice(0, length)
}

/** Vendor prefix of a masked key (`sk-ant-api03-…7f3a` -> `sk-ant-api03-`). */
export function keyPrefix(maskedKey: string) {
  const idx = maskedKey.indexOf("…")
  return idx === -1 ? "key-" : maskedKey.slice(0, idx)
}
