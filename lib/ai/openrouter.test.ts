import { describe, expect, it } from "vitest"

import {
  formatContext,
  formatPrice,
  normalizeModel,
  providerLabel,
  providerLogo,
} from "@/lib/ai/openrouter"

const raw = {
  id: "anthropic/claude-sonnet-5.5",
  canonical_slug: "anthropic/claude-sonnet-5.5-20260928",
  name: "Anthropic: Claude Sonnet 5.5",
  created: 1_790_000_000,
  description: "Sonnet-class model.",
  context_length: 1_000_000,
  architecture: {
    input_modalities: ["text", "image", "file"],
    output_modalities: ["text"],
    tokenizer: "Claude",
  },
  pricing: {
    prompt: "0.000002",
    completion: "0.00001",
    input_cache_read: "0.0000001",
    web_search: "0.01",
  },
  top_provider: { max_completion_tokens: 128_000, is_moderated: true },
  supported_parameters: [
    "tools",
    "reasoning",
    "structured_outputs",
    "temperature",
  ],
}

describe("normalizeModel", () => {
  it("converts per-token prices to per-million and derives capabilities", () => {
    const m = normalizeModel(raw)
    expect(m.provider).toBe("anthropic")
    expect(m.providerLabel).toBe("Anthropic")
    expect(m.promptPrice).toBeCloseTo(2)
    expect(m.completionPrice).toBeCloseTo(10)
    expect(m.cacheReadPrice).toBeCloseTo(0.1)
    expect(m.priceBand).toBe("standard")
    expect(m.capabilities).toEqual([
      "tools",
      "reasoning",
      "structured_outputs",
      "web_search",
      "vision",
    ])
    expect(m.inputModalities).toEqual(["text", "image", "file"])
    expect(m.maxOutput).toBe(128_000)
    expect(m.moderated).toBe(true)
    expect(m.variant).toBeNull()
  })

  it("treats negative router prices as variable, not free", () => {
    const m = normalizeModel({
      ...raw,
      id: "openrouter/auto",
      pricing: { prompt: "-1", completion: "-1" },
    })
    expect(m.promptPrice).toBeNull()
    expect(m.isFree).toBe(false)
    expect(m.priceBand).toBe("variable")
    expect(formatPrice(m.promptPrice)).toBe("Varies")
  })

  it("recognises free models and variant suffixes", () => {
    const m = normalizeModel({
      ...raw,
      id: "liquid/lfm-3:free",
      pricing: { prompt: "0", completion: "0" },
    })
    expect(m.isFree).toBe(true)
    expect(m.priceBand).toBe("free")
    expect(m.variant).toBe(":free")
    expect(m.providerLabel).toBe("Liquid")
  })

  it("flags mandatory reasoning even when the parameter is absent", () => {
    const m = normalizeModel({
      ...raw,
      supported_parameters: ["max_tokens"],
      reasoning: { mandatory: true },
    })
    expect(m.capabilities).toContain("reasoning")
    expect(m.capabilities).not.toContain("tools")
  })
})

describe("formatters", () => {
  it("formats prices compactly", () => {
    expect(formatPrice(0)).toBe("Free")
    expect(formatPrice(0.15)).toBe("$0.15")
    expect(formatPrice(0.0008)).toBe("$0.0008")
    expect(formatPrice(10)).toBe("$10")
    expect(formatPrice(2.5)).toBe("$2.50")
  })
  it("formats context windows", () => {
    expect(formatContext(0)).toBe("—")
    expect(formatContext(262_144)).toBe("262K")
    expect(formatContext(1_048_576)).toBe("1M")
    expect(formatContext(2_000_000)).toBe("2M")
  })
  it("maps vendor slugs to logos and labels", () => {
    expect(providerLogo("x-ai")).toBe("xai")
    expect(providerLogo("anthropic")).toBe("anthropic")
    expect(providerLabel("meta-llama")).toBe("Meta")
    expect(providerLabel("some-new-vendor")).toBe("Some New Vendor")
  })
})
