import { deployedAgents } from "@/lib/data/agentops"
import {
  prompts as seed,
  type Prompt,
  type PromptLabel,
  type PromptType,
  type PromptVersion,
} from "@/lib/data/prompts"
import { NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { createListStore } from "@/lib/store"
import type { ModelParams } from "@/lib/types"

/**
 * Client-side copy of the Prompt Registry. The list page, the record page and
 * the Playground all read from this store, so a draft saved in the Playground
 * shows up in the registry and a promotion on the record moves the list stats.
 * Not persisted: a reload returns to the seed in `lib/data/prompts.ts`.
 */
export const promptStore = createListStore<Prompt>(seed, (p) => p.id)

export function allVersions(list: readonly Prompt[] = promptStore.get()) {
  return list.flatMap((p) => p.versions)
}

/** Version ids are global (`p-N`), so the next number spans every prompt. */
export function nextVersionNumber(list: readonly Prompt[] = promptStore.get()) {
  return Math.max(0, ...allVersions(list).map((v) => v.number)) + 1
}

export function findVersion(
  versionId: string,
  list: readonly Prompt[] = promptStore.get()
) {
  for (const p of list) {
    const v = p.versions.find((x) => x.id === versionId)
    if (v) return { prompt: p, version: v }
  }
  return undefined
}

/** The prompt an agent serves, resolved through its pinned version. */
export function promptForAgent(
  agentId: string,
  list: readonly Prompt[] = promptStore.get()
) {
  const agent = deployedAgents.find((a) => a.id === agentId)
  const pinned = agent && findVersion(agent.promptVersion, list)?.prompt
  if (pinned) return pinned
  return list.find((p) => p.agentId === agentId && p.type === "system")
}

/** Every version of the prompt an agent serves, newest first. */
export function versionsForAgent(
  agentId: string,
  list: readonly Prompt[] = promptStore.get()
) {
  const prompt = promptForAgent(agentId, list)
  return prompt ? [...prompt.versions].reverse() : []
}

export interface DraftInput {
  promptId: string
  template: string
  modelId: string
  params: ModelParams
  changeNote: string
  authorId?: string
  label?: Extract<PromptLabel, "draft" | "staging">
}

/** Appends a new version to a prompt and returns it. */
export function createVersion(input: DraftInput): PromptVersion | undefined {
  const prompt = promptStore.get().find((p) => p.id === input.promptId)
  if (!prompt) return undefined
  const n = nextVersionNumber()
  const version: PromptVersion = {
    id: `p-${n}`,
    promptId: prompt.id,
    number: n,
    label: input.label ?? "draft",
    review: "Pending Approval",
    authorId: input.authorId ?? currentUser.id,
    createdAt: NOW.toISOString(),
    changeNote: input.changeNote,
    evalScore: null,
    modelId: input.modelId,
    params: { ...input.params, stopSequences: [...input.params.stopSequences] },
    template: input.template,
    requests24h: 0,
    cost24h: 0,
  }
  promptStore.patch(prompt.id, (p) => ({
    ...p,
    versions: [...p.versions, version],
    updatedAt: version.createdAt,
  }))
  return version
}

/**
 * Relabels a version. Promoting to production archives the previous
 * production version; the other labels only touch the target.
 */
export function setVersionLabel(
  promptId: string,
  versionId: string,
  label: PromptLabel
) {
  promptStore.patch(promptId, (p) => ({
    ...p,
    versions: p.versions.map((v) => {
      if (v.id === versionId)
        return {
          ...v,
          label,
          review: label === "production" ? "Approved" : v.review,
        }
      if (label === "production" && v.label === "production")
        return { ...v, label: "archived" }
      return v
    }),
  }))
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export interface NewPromptInput {
  name: string
  agentId: string
  type: PromptType
  template: string
  modelId: string
  params: ModelParams
  description?: string
}

/** Registers a prompt with a first draft version and returns the record. */
export function createPrompt(input: NewPromptInput): Prompt {
  const list = promptStore.get()
  const base = `prm-${slugify(input.name) || "prompt"}`
  let id = base
  for (let i = 2; list.some((p) => p.id === id); i++) id = `${base}-${i}`
  const n = nextVersionNumber(list)
  const createdAt = NOW.toISOString()
  const version: PromptVersion = {
    id: `p-${n}`,
    promptId: id,
    number: n,
    label: "draft",
    review: "Pending Approval",
    authorId: currentUser.id,
    createdAt,
    changeNote: "Initial draft",
    evalScore: null,
    modelId: input.modelId,
    params: { ...input.params, stopSequences: [...input.params.stopSequences] },
    template: input.template,
    requests24h: 0,
    cost24h: 0,
  }
  const prompt: Prompt = {
    id,
    slug: `${slugify(input.agentId.replace(/^agt-/, ""))}/${slugify(input.name)}`,
    name: input.name,
    description: input.description ?? "",
    agentId: input.agentId,
    type: input.type,
    ownerId: currentUser.id,
    createdAt,
    updatedAt: createdAt,
    guardrailIds: [],
    guardrails: [],
    variables: {},
    versions: [version],
  }
  promptStore.add(prompt, "start")
  return prompt
}

/** Summary used by the "Awaiting review" stat: pending versions by label. */
export function awaitingReviewByLabel(list: readonly Prompt[]) {
  const counts: Partial<Record<PromptLabel, number>> = {}
  for (const v of allVersions(list)) {
    if (v.review !== "Pending Approval") continue
    counts[v.label] = (counts[v.label] ?? 0) + 1
  }
  return counts
}
