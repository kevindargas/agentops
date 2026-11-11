import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { normalizeBasePath, resolveRequest } from "./serve-static.mjs"

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "agentops-out-"))
  writeFileSync(join(root, "index.html"), "<html>root</html>")
  writeFileSync(join(root, "404.html"), "<html>missing</html>")
  mkdirSync(join(root, "dashboard"))
  writeFileSync(join(root, "dashboard", "index.html"), "<html>dash</html>")
  mkdirSync(join(root, "_next", "static", "chunks"), { recursive: true })
  writeFileSync(join(root, "_next", "static", "chunks", "a.js"), "1")
  writeFileSync(join(root, "legacy.html"), "<html>legacy</html>")
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe("scripts/serve-static", () => {
  it("normalises the base path", () => {
    expect(normalizeBasePath("")).toBe("")
    expect(normalizeBasePath("/")).toBe("")
    expect(normalizeBasePath("/agentops")).toBe("/agentops")
    expect(normalizeBasePath("/agentops/")).toBe("/agentops")
  })

  it("serves directory indexes under the base path", () => {
    const r = resolveRequest("/agentops/dashboard/", {
      root,
      basePath: "/agentops",
    })
    expect(r).toEqual({
      kind: "file",
      path: join(root, "dashboard", "index.html"),
      status: 200,
    })
    expect(
      resolveRequest("/agentops/", { root, basePath: "/agentops" })
    ).toEqual({ kind: "file", path: join(root, "index.html"), status: 200 })
  })

  it("redirects directory URLs without a trailing slash like Pages does", () => {
    expect(
      resolveRequest("/agentops/dashboard", { root, basePath: "/agentops" })
    ).toEqual({ kind: "redirect", location: "/agentops/dashboard/" })
    expect(
      resolveRequest("/agentops", { root, basePath: "/agentops" })
    ).toEqual({ kind: "redirect", location: "/agentops/" })
    expect(resolveRequest("/", { root, basePath: "/agentops" })).toEqual({
      kind: "redirect",
      location: "/agentops/",
    })
  })

  it("serves hashed assets and falls back to .html files", () => {
    expect(
      resolveRequest("/agentops/_next/static/chunks/a.js?v=1", {
        root,
        basePath: "/agentops",
      })
    ).toMatchObject({ kind: "file", status: 200 })
    expect(
      resolveRequest("/agentops/legacy", { root, basePath: "/agentops" })
    ).toEqual({ kind: "file", path: join(root, "legacy.html"), status: 200 })
  })

  it("answers unknown routes and paths outside the base with 404.html", () => {
    const missing = { kind: "notFound", path: join(root, "404.html") }
    expect(
      resolveRequest("/agentops/does-not-exist/", {
        root,
        basePath: "/agentops",
      })
    ).toEqual(missing)
    expect(resolveRequest("/other/", { root, basePath: "/agentops" })).toEqual(
      missing
    )
    expect(
      resolveRequest("/agentops/../../etc/passwd", {
        root,
        basePath: "/agentops",
      })
    ).toEqual(missing)
  })

  it("works with no base path", () => {
    expect(resolveRequest("/dashboard/", { root })).toMatchObject({
      kind: "file",
      status: 200,
    })
    expect(resolveRequest("/nope/", { root })).toEqual({
      kind: "notFound",
      path: join(root, "404.html"),
    })
  })
})
