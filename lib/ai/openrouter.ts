/**
 * OpenRouter model catalog. Fetched server-side from the public, keyless
 * endpoint and normalized into a small, serializable shape for the UI.
 * https://openrouter.ai/api/v1/models
 */

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

/** Raw response item (only the fields we read). */
export interface RawModel {
  id: string
  canonical_slug?: string
  hugging_face_id?: string | null
  name: string
  created: number
  description: string
  context_length: number | null
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
    tokenizer?: string
    instruct_type?: string | null
  }
  pricing?: Record<string, string | undefined>
  top_provider?: {
    context_length?: number | null
    max_completion_tokens?: number | null
    is_moderated?: boolean
  }
  supported_parameters?: string[]
  knowledge_cutoff?: string | null
  reasoning?: { mandatory?: boolean } | null
}

export type Modality = "text" | "image" | "file" | "audio" | "video"
export type Capability =
  "tools" | "reasoning" | "structured_outputs" | "web_search" | "vision"
export type PriceBand = "free" | "budget" | "standard" | "premium" | "variable"

export interface CatalogModel {
  id: string
  slug: string
  name: string
  /** Vendor slug derived from the id prefix, e.g. "anthropic". */
  provider: string
  providerLabel: string
  description: string
  createdAt: string
  contextLength: number
  maxOutput: number | null
  inputModalities: Modality[]
  outputModalities: string[]
  /** USD per 1M tokens. `null` when pricing varies by routed model (OpenRouter's auto routers). */
  promptPrice: number | null
  completionPrice: number | null
  cacheReadPrice: number | null
  imagePrice: number | null
  webSearchPrice: number | null
  isFree: boolean
  priceBand: PriceBand
  capabilities: Capability[]
  supportedParameters: string[]
  moderated: boolean
  knowledgeCutoff: string | null
  tokenizer: string | null
  /** Batch and other variant suffixes, e.g. ":batch", ":free". */
  variant: string | null
}

export interface CatalogResult {
  models: CatalogModel[]
  fetchedAt: string
  error?: string
}

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "meta-llama": "Meta",
  meta: "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  "x-ai": "xAI",
  qwen: "Qwen",
  "z-ai": "Z.ai",
  moonshotai: "Moonshot",
  nvidia: "NVIDIA",
  minimax: "MiniMax",
  tencent: "Tencent",
  openrouter: "OpenRouter",
  cohere: "Cohere",
  perplexity: "Perplexity",
  amazon: "Amazon",
  microsoft: "Microsoft",
  liquid: "Liquid",
  baidu: "Baidu",
  bytedance: "ByteDance",
  inception: "Inception",
  ai21: "AI21",
}

/** Maps an OpenRouter vendor slug to a models.dev logo slug. */
export function providerLogo(provider: string) {
  const map: Record<string, string> = {
    "x-ai": "xai",
    mistralai: "mistral",
    "meta-llama": "llama",
    meta: "llama",
    moonshotai: "moonshotai",
    "z-ai": "zai",
    qwen: "alibaba",
  }
  return map[provider] ?? provider
}

export function providerLabel(provider: string) {
  return (
    providerLabels[provider] ??
    provider.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/** Negative prices mean "depends on the routed model"; treat them as unknown. */
const perMillion = (v?: string) => {
  const n = v === undefined ? NaN : Number(v)
  return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : null
}

const priceBand = (
  prompt: number | null,
  completion: number | null
): PriceBand => {
  if (prompt === null || completion === null) return "variable"
  if (prompt === 0 && completion === 0) return "free"
  if (prompt < 1) return "budget"
  if (prompt < 5) return "standard"
  return "premium"
}

export const priceBandMeta: Record<PriceBand, { label: string; hint: string }> =
  {
    free: { label: "Free", hint: "No charge for prompt or completion tokens" },
    budget: { label: "Budget", hint: "Under $1 per 1M input tokens" },
    standard: { label: "Standard", hint: "$1 to $5 per 1M input tokens" },
    premium: { label: "Premium", hint: "$5 or more per 1M input tokens" },
    variable: {
      label: "Varies",
      hint: "Priced by whichever model the router selects",
    },
  }

export const capabilityMeta: Record<
  Capability,
  { label: string; hint: string }
> = {
  tools: { label: "Tool use", hint: "Supports function/tool calling" },
  reasoning: { label: "Reasoning", hint: "Exposes extended thinking" },
  structured_outputs: {
    label: "JSON schema",
    hint: "Structured outputs / response_format",
  },
  web_search: { label: "Web search", hint: "Built-in web search pricing" },
  vision: { label: "Vision", hint: "Accepts image input" },
}

export const modalityMeta: Record<Modality, string> = {
  text: "Text",
  image: "Image",
  file: "File",
  audio: "Audio",
  video: "Video",
}

export function normalizeModel(raw: RawModel): CatalogModel {
  const [provider, ...rest] = raw.id.split("/")
  const tail = rest.join("/")
  const variant = tail.includes(":") ? tail.slice(tail.indexOf(":")) : null
  const pricing = raw.pricing ?? {}
  const promptPrice =
    pricing.prompt === undefined ? 0 : perMillion(pricing.prompt)
  const completionPrice =
    pricing.completion === undefined ? 0 : perMillion(pricing.completion)
  const params = raw.supported_parameters ?? []
  const inputs = (raw.architecture?.input_modalities ?? ["text"]).filter(
    (m): m is Modality =>
      ["text", "image", "file", "audio", "video"].includes(m)
  )
  const capabilities: Capability[] = []
  if (params.includes("tools")) capabilities.push("tools")
  if (params.includes("reasoning") || raw.reasoning?.mandatory)
    capabilities.push("reasoning")
  if (
    params.includes("structured_outputs") ||
    params.includes("response_format")
  )
    capabilities.push("structured_outputs")
  if (pricing.web_search !== undefined && Number(pricing.web_search) > 0)
    capabilities.push("web_search")
  if (inputs.includes("image")) capabilities.push("vision")
  return {
    id: raw.id,
    slug: raw.canonical_slug ?? raw.id,
    name: raw.name,
    provider,
    providerLabel: providerLabel(provider),
    description: raw.description ?? "",
    createdAt: new Date(raw.created * 1000).toISOString(),
    contextLength: raw.context_length ?? raw.top_provider?.context_length ?? 0,
    maxOutput: raw.top_provider?.max_completion_tokens ?? null,
    inputModalities: inputs,
    outputModalities: raw.architecture?.output_modalities ?? ["text"],
    promptPrice,
    completionPrice,
    cacheReadPrice: perMillion(pricing.input_cache_read),
    imagePrice: pricing.image !== undefined ? Number(pricing.image) : null,
    webSearchPrice:
      pricing.web_search !== undefined ? Number(pricing.web_search) : null,
    isFree: promptPrice === 0 && completionPrice === 0,
    priceBand: priceBand(promptPrice, completionPrice),
    capabilities,
    supportedParameters: params,
    moderated: raw.top_provider?.is_moderated ?? false,
    knowledgeCutoff: raw.knowledge_cutoff ?? null,
    tokenizer: raw.architecture?.tokenizer ?? null,
    variant,
  }
}

/** Format a USD-per-1M-token price compactly: $0 → "Free", 0.15 → "$0.15", null → "Varies". */
export function formatPrice(perM: number | null) {
  if (perM === null) return "Varies"
  if (perM === 0) return "Free"
  if (perM < 0.01) return `$${perM.toFixed(4)}`
  if (perM < 1) return `$${perM.toFixed(2)}`
  return `$${perM.toFixed(2).replace(/\.00$/, "")}`
}

/** 262144 → "262K", 1048576 → "1M". */
export function formatContext(tokens: number) {
  if (!tokens) return "—"
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  return `${Math.round(tokens / 1000)}K`
}
