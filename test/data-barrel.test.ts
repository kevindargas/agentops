import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import * as barrel from "@/lib/data"

/**
 * Every module under lib/data is re-exported from `lib/data/index.ts` (see
 * "Feature layout and ids" in conventions.md). `export *` silently drops a
 * name that two modules both export, so this also catches collisions: a name
 * exported by a module but missing from the barrel shows up here.
 */
const modules = readdirSync(join(process.cwd(), "lib", "data"))
  .filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "index.ts"
  )
  .map((f) => f.replace(/\.ts$/, ""))

describe("lib/data barrel", () => {
  it("sees every module", () => {
    expect(modules.length).toBeGreaterThan(10)
  })

  for (const name of modules) {
    it(`exposes every export of ${name}.ts`, async () => {
      const mod: Record<string, unknown> = await import(
        `../lib/data/${name}.ts`
      )
      const missing = Object.keys(mod).filter((key) => !(key in barrel))
      expect(
        missing,
        `${name}.ts exports missing from the barrel (not re-exported, or colliding with another module)`
      ).toEqual([])
    })
  }
})
