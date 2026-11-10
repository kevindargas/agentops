import type { Priority } from "@/lib/types"
import {
  deployedAgents,
  agentTraces,
  semanticEntities,
} from "@/lib/data/agentops"
import { getCatalogItem, knowledgeArticles } from "@/lib/data/catalog"
import { releases } from "@/lib/data/deployments"
import { changes, incidents, problems, requests } from "@/lib/data/itsm"
import { prompts, promptTypeLabel } from "@/lib/data/prompts"

/**
 * Serialisable record search index for the command menu. Built on the server
 * in `app/(app)/layout.tsx` and passed down as a prop, so the fixtures behind
 * it never ship in the client bundle. Icons and badges are resolved on the
 * client from `kind`, `state` and `priority`.
 */
export type SearchKind =
  | "Incident"
  | "Problem"
  | "Change"
  | "Request"
  | "Article"
  | "Agent"
  | "Semantic layer"
  | "Prompt"
  | "Release"
  | "Trace"

export interface SearchEntry {
  kind: SearchKind
  /** Mono column: record number, id or slug. */
  number: string
  title: string
  href: string
  /** Lower-case haystack the query is matched against. */
  text: string
  state?: string
  priority?: Priority
  /** Free-text meta shown when there is no state badge. */
  meta?: string
}

const text = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" ").toLowerCase()

export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = []
  for (const i of incidents)
    out.push({
      kind: "Incident",
      number: i.number,
      title: i.shortDescription,
      href: `/itsm/incidents/${i.number}`,
      text: text(i.number, i.shortDescription),
      priority: i.priority,
    })
  for (const p of problems)
    out.push({
      kind: "Problem",
      number: p.number,
      title: p.shortDescription,
      href: `/itsm/problems/${p.number}`,
      text: text(p.number, p.shortDescription),
      state: p.state,
    })
  for (const c of changes)
    out.push({
      kind: "Change",
      number: c.number,
      title: c.shortDescription,
      href: `/itsm/changes/${c.number}`,
      text: text(c.number, c.shortDescription),
      state: c.state,
    })
  for (const r of requests) {
    const items = r.items
      .map((i) => getCatalogItem(i.catalogItemId)?.name ?? i.number)
      .join(", ")
    out.push({
      kind: "Request",
      number: r.number,
      title: items || `${r.items.length} item(s)`,
      href: `/itsm/requests/${r.number}`,
      text: text(r.number, items),
      state: r.state,
    })
  }
  for (const k of knowledgeArticles)
    out.push({
      kind: "Article",
      number: k.number,
      title: k.title,
      href: `/itsm/knowledge/${k.number}`,
      text: text(k.number, k.title),
      state: k.state,
    })
  for (const a of deployedAgents)
    out.push({
      kind: "Agent",
      number: a.id,
      title: a.name,
      href: `/agentops/agents/${a.id}`,
      text: text(a.id, a.name, a.team, a.framework, a.modelId),
      state: a.health,
    })
  for (const s of semanticEntities)
    out.push({
      kind: "Semantic layer",
      number: s.kind,
      title: s.name,
      href: `/agentops/semantic-layer?entity=${s.id}`,
      text: text(s.name, s.kind, s.domain, ...s.synonyms),
      state: s.status,
    })
  for (const p of prompts)
    out.push({
      kind: "Prompt",
      number: p.slug,
      title: p.name,
      href: `/agentops/prompts/${p.id}`,
      text: text(p.id, p.slug, p.name, p.type),
      meta: promptTypeLabel[p.type],
    })
  for (const r of releases)
    out.push({
      kind: "Release",
      number: r.id,
      title: `${r.version} ${r.summary}`,
      href: `/agentops/deployments/${r.id}`,
      text: text(r.id, r.version, r.summary, r.agentId),
      state: r.stage,
    })
  for (const t of agentTraces)
    out.push({
      kind: "Trace",
      number: t.id,
      title: t.userQuery,
      href: `/agentops/traces/${t.id}`,
      text: text(t.id, t.userQuery, t.agentId),
      state: t.status,
    })
  return out
}
