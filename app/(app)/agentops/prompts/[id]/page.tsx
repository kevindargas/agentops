import type { Metadata } from "next"
import Link from "next/link"
import {
  BotIcon,
  ClockIcon,
  FlaskConicalIcon,
  HistoryIcon,
  ShieldCheckIcon,
  TargetIcon,
  UserIcon,
} from "lucide-react"

import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { PromptHeaderActions } from "@/features/agentops/prompts/prompt-header-actions"
import { PromptWorkspace } from "@/features/agentops/prompts/prompt-workspace"
import { LabelBadge, TypeBadge } from "@/features/agentops/prompts/shared"
import { AgentChip, ModelChip, ScoreBar } from "@/features/agentops/shared"
import { experiments, getDeployedAgent } from "@/lib/data"
import {
  estimateTokens,
  extractVariables,
  getPrompt,
  latestVersion,
  productionVersion,
  promptLabels,
  promptTypeLabel,
} from "@/lib/data/prompts"
import { formatDate, formatNumber, timeAgo } from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: getPrompt(id)?.name ?? id }
}

export default async function PromptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const prompt = getPrompt(id)
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
              className="font-mono text-[11px] text-muted-foreground"
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
            message: `Evaluating v${latest.number} against ${agent?.evalDataset ?? "the golden set"}`,
          },
          {
            label: "Duplicate prompt",
            message: "Copied as a new draft prompt",
          },
          {
            label: "Archive prompt",
            destructive: true,
            separatorBefore: true,
            confirm: {
              title: "Archive this prompt?",
              description:
                "Agents pinned to a production version keep working; no new versions can be created.",
              actionLabel: "Archive",
            },
            message: "Prompt archived",
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
                      <code className="rounded-sm bg-muted px-1 font-mono text-[11px]">
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
              count={prompt.guardrails.length}
            >
              {prompt.guardrails.length === 0 ? (
                <EmptyState
                  size="sm"
                  bare
                  icon={<ShieldCheckIcon />}
                  title="No guardrails attached"
                  description="Policies attach at the agent level until this prompt gets its own."
                />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {prompt.guardrails.map((g) => (
                    <li
                      key={g}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{g}</span>
                      <StateBadge state="Active" size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </RecordSection>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            size="sm"
            label="Production eval"
            value={
              prod?.evalScore !== null && prod?.evalScore !== undefined ? (
                <ScoreBar value={prod.evalScore} />
              ) : (
                "—"
              )
            }
            hint={
              prod ? `v${prod.number} · ${prod.id}` : "no production version"
            }
          />
          <StatCard
            size="sm"
            label="Requests · 24h"
            value={formatNumber(requests24h)}
            hint={`${prompt.versions.filter((v) => v.requests24h > 0).length} serving versions`}
          />
          <StatCard
            size="sm"
            label="Variables"
            value={extractVariables((prod ?? latest).template).length}
            hint="in the production template"
          />
          <StatCard
            size="sm"
            label="Prompt tokens"
            value={`~${formatNumber(estimateTokens((prod ?? latest).template))}`}
            hint="estimated per request, before variables"
          />
        </div>

        <PromptWorkspace prompt={prompt} />
      </RecordLayout>
    </>
  )
}
