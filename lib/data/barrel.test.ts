import { readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import * as barrel from "./index"

/**
 * Names that collide between modules. The barrel pins the canonical one and
 * the other module exports an alias; both must be reachable.
 */
const aliases: Record<string, Record<string, string>> = {
  playground: {
    modelPricing: "playgroundModelPricing",
    extractVariables: "extractPlaygroundVariables",
  },
}

const moduleFiles = readdirSync(join(__dirname))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => f.replace(/\.ts$/, ""))
  .filter((f) => f !== "index")

describe("lib/data barrel", () => {
  it("re-exports every named export of every module", async () => {
    const barrelKeys = new Set(Object.keys(barrel))
    for (const name of moduleFiles) {
      const mod = (await import(`./${name}`)) as Record<string, unknown>
      for (const key of Object.keys(mod)) {
        const exported = aliases[name]?.[key] ?? key
        expect(barrelKeys.has(exported), `${name}.${key}`).toBe(true)
        if (aliases[name]?.[key]) continue
        expect(
          (barrel as Record<string, unknown>)[key],
          `${name}.${key} is shadowed`
        ).toBe(mod[key])
      }
    }
  })

  it("resolves the pinned collisions to the intended module", async () => {
    const costs = await import("./costs")
    const prompts = await import("./prompts")
    const playground = await import("./playground")
    expect(barrel.modelPricing).toBe(costs.modelPricing)
    expect(barrel.extractVariables).toBe(prompts.extractVariables)
    expect(barrel.playgroundModelPricing).toBe(playground.modelPricing)
    expect(barrel.extractPlaygroundVariables).toBe(playground.extractVariables)
  })
})
