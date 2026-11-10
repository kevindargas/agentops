"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BotIcon,
  ClockIcon,
  FlaskConicalIcon,
  HistoryIcon,
  ShieldCheckIcon,
  TargetIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { experiments, getDeployedAgent } from "@/lib/data/agentops"
import {
  estimateTokens,
  extractVariables,
  latestVersion,
  productionVersion,
  promptLabels,
  promptTypeLabel,
} from "@/lib/data/prompts"
import { formatDate, formatNumber, timeAgo } from "@/lib/format"
import { AgentChip, ModelChip, ScoreBar } from "../shared"
import { PromptHeaderActions } from "./prompt-header-actions"
import { createPrompt, promptStore, setVersionLabel } from "./prompt-store"
import { PromptWorkspace } from "./prompt-workspace"
import { LabelBadge, TypeBadge } from "./shared"

/**
 * Prompt record. Reads the prompt from the shared client store so the header
 * labels, the review chip and the stat cards move when a version is promoted
 * or drafted, and so prompts created in this session resolve.
 */
export function PromptRecord({ id }: { id: string }) {
  const router = useRouter()
  const prompt = promptStore.use().find((p) => p.id === id)
  if (!prompt)
    return (
      <RecordNotFound
        number={id}
        backHref="/agentops/prompts"
        backLabel="prompts"
      />
    )

  const agent = getDeployedAgent(prompt.agentId)
  const prod = productionVersion(prompt)
  const latest = latestVersion(prompt)
  const present = new Set(prompt.versions.map((v) => v.label))
  const labels = promptLabels.filter((l) => present.has(l))
  const versionIds = new Set(prompt.versions.map((v) => v.id))
  const linkedExperiments = experiments.filter((e) =>
    e.variants.some((v) => v.promptVersion && versionIds.has(v.promptVersion))
  )
  const requests24h = prompt.versions.reduce((a, v) => a + v.requests24h, 0)
  const awaiting = prompt.versions.filter(
    (v) => v.review === "Pending Approval"
  ).length
  const current = prod ?? latest

  return (
    <>
      <RecordHeader
        number={prompt.id}
        title={prompt.name}
        backHref="/agentops/prompts"
        backLabel="prompts"
        description={prompt.description}
        badges={
          <>
            {labels.map((l) => (
              <LabelBadge key={l} label={l} />
            ))}
            <TypeBadge type={prompt.type} />
            <Badge
              variant="outline"
              className="font-mono text-2xs text-muted-foreground"
            >
              {prompt.slug}
            </Badge>
          </>
        }
        meta={
          <>
            <MetaItem label="Owner" icon={<UserIcon />}>
              <UserChip userId={prompt.ownerId} size="xs" />
            </MetaItem>
            <MetaItem label="Agent" icon={<BotIcon />}>
              <AgentChip agentId={prompt.agentId} size="sm" />
            </MetaItem>
            <MetaItem label="Versions" icon={<HistoryIcon />}>
              {prompt.versions.length} · latest v{latest.number}
            </MetaItem>
            <MetaItem label="Updated" icon={<ClockIcon />}>
              {timeAgo(prompt.updatedAt)}
            </MetaItem>
            {awaiting > 0 && (
              <MetaItem label="Review" icon={<TargetIcon />} tone="warning">
                {awaiting} awaiting approval
              </MetaItem>
            )}
          </>
        }
        actions={<PromptHeaderActions prompt={prompt} />}
        overflow={[
          {
            label: "Run evals on latest",
            icon: <FlaskConicalIcon />,
            href: `/agentops/evals?tab=runs`,
            message: `Opening eval runs for v${latest.number}. Runs are started from Evals & Datasets.`,
          },
          {
            label: "Duplicate prompt",
            onSelect: () => {
              const copy = createPrompt({
                name: `${prompt.name} (copy)`,
                agentId: prompt.agentId,
                type: prompt.type,
                template: current.template,
                modelId: current.modelId,
                params: current.params,
                description: prompt.description,
              })
              toast.success(`${copy.name} created as a draft`, {
                description: `Copied v${current.number}'s template and parameters into ${copy.versions[0].id}.`,
                action: {
                  label: "Open",
                  onClick: () => router.push(`/agentops/prompts/${copy.id}`),
                },
              })
              return false
            },
          },
          {
            label: "Archive prompt",
            destructive: true,
            separatorBefore: true,
            confirm: {
              title: "Archive this prompt?",
              description:
                "Every version is labelled archived. Agents pinned to the current production version keep working in this template; a rollback from the Versions tab restores it.",
              actionLabel: "Archive",
            },
            onSelect: () => {
              for (const v of prompt.versions)
                if (v.label !== "archived")
                  setVersionLabel(prompt.id, v.id, "archived")
            },
            message: `${prompt.name}: ${prompt.versions.length} versions archived`,
          },
        ]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection title="Details" size="sm">
              <DetailList
                variant="rows"
                dense
                items={[
                  {
                    label: "Owner",
                    value: <UserChip userId={prompt.ownerId} size="xs" />,
                  },
                  {
                    label: "Agent",
                    value: <AgentChip agentId={prompt.agentId} size="sm" />,
                  },
                  { label: "Type", value: promptTypeLabel[prompt.type] },
                  {
                    label: "Created",
                    value: formatDate(prompt.createdAt),
                  },
                  {
                    label: "Labels",
                    value: (
                      <span className="flex flex-wrap gap-1">
                        {labels.map((l) => (
                          <LabelBadge key={l} label={l} size="sm" />
                        ))}
                      </span>
                    ),
                  },
                  {
                    label: "Production",
                    value: prod ? (
                      <ModelChip modelId={prod.modelId} className="text-xs" />
                    ) : (
                      "None"
                    ),
                  },
                  {
                    label: "Slug",
                    value: prompt.slug,
                    mono: true,
                    copyable: true,
                  },
                ]}
              />
            </RecordSection>

            <RecordSection
              title="Linked evals"
              size="sm"
              icon={<TargetIcon />}
              count={(agent ? 1 : 0) + linkedExperiments.length}
            >
              <ul className="flex flex-col gap-2 text-sm">
                {agent && (
                  <li className="flex items-center justify-between gap-2">
                    <Link
                      href={`/agentops/agents/${agent.id}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      <code className="rounded-sm bg-muted px-1 font-mono text-2xs">
                        {agent.evalDataset}
                      </code>
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      golden set
                    </span>
                  </li>
                )}
                {linkedExperiments.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/agentops/experiments?open=${e.id}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      {e.name}
                    </Link>
                    <StateBadge state={e.status} size="sm" />
                  </li>
                ))}
              </ul>
            </RecordSection>

            <RecordSection
              title="Guardrails"
              size="sm"
              icon={<ShieldCheckIcon />}
              count={prompt.guardrailIds.length}
            >
              {prompt.guardrailIds.length === 0 ? (
                <EmptyState
                  size="sm"
                  bare
                  icon={<ShieldCheckIcon />}
                  title="No guardrails attached"
                  description="Policies attach at the agent level until this prompt gets its own."
                />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {prompt.guardrailIds.map((gid, i) => (
                    <li
                      key={gid}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <Link
                        href={`/agentops/guardrails?policy=${gid}`}
                        className="min-w-0 truncate hover:underline"
                      >
                        {prompt.guardrails[i] ?? gid}
                      </Link>
                      <StateBadge state="Active" size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </RecordSection>
          </>
        }
      >
        <StatGrid columns={4}>
          <StatCard
            label="Production eval"
            value={
              prod?.evalScore !== null && prod?.evalScore !== undefined ? (
                <ScoreBar value={prod.evalScore} />
              ) : (
                "Not run"
              )
            }
            hint={
              prod ? `v${prod.number} · ${prod.id}` : "no production version"
            }
          />
          <StatCard
            label="Requests · 24h"
            value={formatNumber(requests24h)}
            hint={`${prompt.versions.filter((v) => v.requests24h > 0).length} serving versions`}
          />
          <StatCard
            label="Variables"
            value={extractVariables(current.template).length}
            hint={
              prod ? "in the production template" : "in the latest template"
            }
          />
          <StatCard
            label="Prompt tokens"
            value={`~${formatNumber(estimateTokens(current.template))}`}
            hint="estimated per request, before variables"
          />
        </StatGrid>

        <PromptWorkspace prompt={prompt} />
      </RecordLayout>
    </>
  )
}
