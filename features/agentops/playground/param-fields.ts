import {
  paramFields,
  type ParamDiff,
  type ParamField,
} from "@/lib/data/playground"
import type { ModelParams } from "@/lib/types"

const fmtPenalty = (v: number | undefined) =>
  v === undefined ? "none" : v.toFixed(1)

/**
 * `ModelParams` declares optional frequency and presence penalties that the
 * shared `paramFields` list in `lib/data/playground.ts` does not cover yet.
 * The editor, the diff and the parameter grids read this extended list so the
 * two penalties are editable, diffed and shareable like every other field.
 */
export const penaltyFields: ParamField[] = [
  {
    key: "frequencyPenalty",
    label: "Frequency penalty",
    description:
      "Penalises tokens by how often they already appeared, -2 to 2.",
    format: (p) => fmtPenalty(p.frequencyPenalty),
  },
  {
    key: "presencePenalty",
    label: "Presence penalty",
    description: "Penalises tokens that appeared at all, nudging new topics.",
    format: (p) => fmtPenalty(p.presencePenalty),
  },
]

export const allParamFields: ParamField[] = [...paramFields, ...penaltyFields]

/** `diffParams` from the data layer, extended with the penalty fields. */
export function diffAllParams(current: ModelParams, base: ModelParams) {
  const out: ParamDiff[] = []
  for (const f of allParamFields) {
    const a = f.format(current)
    const b = f.format(base)
    if (a !== b) out.push({ key: f.key, label: f.label, from: b, to: a })
  }
  return out
}

export const PENALTY_PARAMS = {
  frequencyPenalty: "freq_penalty",
  presencePenalty: "presence_penalty",
} as const

function clampPenalty(raw: string | null) {
  if (raw === null || raw === "") return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.max(-2, Math.min(2, Math.round(n * 10) / 10))
}

/** Reads the two penalty params the shared URL codec does not know about. */
export function readPenaltyParams(
  sp: URLSearchParams,
  params: ModelParams
): ModelParams {
  const frequencyPenalty = clampPenalty(sp.get(PENALTY_PARAMS.frequencyPenalty))
  const presencePenalty = clampPenalty(sp.get(PENALTY_PARAMS.presencePenalty))
  if (frequencyPenalty === undefined && presencePenalty === undefined)
    return params
  return {
    ...params,
    ...(frequencyPenalty !== undefined ? { frequencyPenalty } : {}),
    ...(presencePenalty !== undefined ? { presencePenalty } : {}),
  }
}

export function writePenaltyParams(sp: URLSearchParams, params: ModelParams) {
  if (params.frequencyPenalty !== undefined)
    sp.set(PENALTY_PARAMS.frequencyPenalty, String(params.frequencyPenalty))
  if (params.presencePenalty !== undefined)
    sp.set(PENALTY_PARAMS.presencePenalty, String(params.presencePenalty))
  return sp
}
