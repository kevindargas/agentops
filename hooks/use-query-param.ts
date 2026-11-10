"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

/**
 * How a write lands in the history stack. `replace` (default) keeps sheets and
 * tabs out of the back button; `push` adds an entry the user can go back to.
 */
export type QueryParamMode = "replace" | "push"

/** `null`, `undefined` and `""` delete the key. */
export type QueryParamValue = string | null | undefined

/**
 * Merge several query params into the current URL in one history update
 * without a navigation. Next.js mirrors `history.replaceState` /
 * `history.pushState` into `useSearchParams`, so client readers update in
 * place and the server page is not re-rendered. Use `router.replace` only
 * when the server component needs the new value for data.
 */
export function setQueryParams(
  patch: Record<string, QueryParamValue>,
  mode: QueryParamMode = "replace"
) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(patch)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  if (url.href === window.location.href) return
  if (mode === "push") window.history.pushState(window.history.state, "", url)
  else window.history.replaceState(window.history.state, "", url)
}

/** Set or clear one query param. See `setQueryParams`. */
export function setQueryParam(
  key: string,
  value: QueryParamValue,
  mode: QueryParamMode = "replace"
) {
  setQueryParams({ [key]: value }, mode)
}

/**
 * Read one query param through `useSearchParams` (so the caller must sit
 * inside `<Suspense>`) and write it back without a navigation.
 *
 * @example
 * const [openId, setOpenId] = useQueryParam("policy")
 * setOpenId(row.id)   // ?policy=grd-001
 * setOpenId(null)     // key removed
 */
export function useQueryParam(
  key: string,
  { mode = "replace" }: { mode?: QueryParamMode } = {}
) {
  const params = useSearchParams()
  const value = params.get(key)
  const set = React.useCallback(
    (next: QueryParamValue) => setQueryParams({ [key]: next }, mode),
    [key, mode]
  )
  return [value, set] as const
}
