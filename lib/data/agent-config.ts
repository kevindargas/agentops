/**
 * Agent configuration surface shown on the agent record (autonomy, budgets,
 * guardrails, knowledge sources, schedule). Everything is derived from the
 * other data modules so the panel links to the same records those pages show.
 */

import type { Autonomy } from "@/lib/ai/agents"
import { deployedAgents, getDeployedAgent } from "./agentops"
import { budgets } from "./costs"
import { guardrailsForAgent } from "./guardrails"
import { knowledgeBases } from "./knowledge"
import { describeCron, schedules, triggers } from "./schedules"
import { NOW } from "./seed"

export type { Autonomy }

export interface AgentOpsConfig {
  autonomy: Autonomy
  budgets: {
    /** USD per day. */
    dailyCostCap: number
    /** Spend so far this month, USD. */
    monthToDate: number
    maxTokensPerRun: number
    /** Budget record the cap comes from, when one exists. */
    budgetId?: string
  }
  /** Ids of the active guardrail policies in scope for the agent. */
  guardrailIds: string[]
  /** Display names of `guardrailIds`, same order. */
  guardrails: string[]
  /** Ids of the knowledge bases the agent may retrieve from. */
  knowledgeBaseIds: string[]
  /** Display names of `knowledgeBaseIds`, same order. */
  knowledgeSources: string[]
  schedule: { label: string; detail: string }
}

const writeVerbs = /^(create|open|reset|request|update|close|retire)_/

/** Autonomy, budgets, guardrails, knowledge and schedule for an agent. */
export function getAgentOpsConfig(agentId: string): AgentOpsConfig {
  const agent = getDeployedAgent(agentId) ?? deployedAgents[0]
  const writes = agent.tools.some((t) => writeVerbs.test(t))
  const autonomy: Autonomy =
    agent.environment === "staging"
      ? "suggest"
      : writes
        ? "approve"
        : "autonomous"

  const dailyBudget = budgets.find(
    (b) =>
      b.scope.kind === "agent" &&
      b.scope.id === agent.id &&
      b.period === "daily"
  )
  const monthlyBudget = budgets.find(
    (b) =>
      b.scope.kind === "agent" &&
      b.scope.id === agent.id &&
      b.period === "monthly"
  )
  const budget = dailyBudget ?? monthlyBudget
  const dailyCostCap =
    dailyBudget?.limit ??
    Math.max(50, Math.ceil((agent.metrics.costPerDay * 1.5) / 50) * 50)
  // Month to date from the monthly budget when there is one, otherwise from
  // the daily budget's history (or the run-rate) over the days elapsed.
  const dayOfMonth = NOW.getUTCDate()
  const monthToDate = monthlyBudget
    ? monthlyBudget.spent
    : Math.round(
        budget
          ? budget.history.slice(-dayOfMonth).reduce((s, h) => s + h.spent, 0)
          : agent.metrics.costPerDay * dayOfMonth
      )

  const policies = guardrailsForAgent(agent.id)
  const kbs = knowledgeBases.filter((k) => k.access.agentIds.includes(agent.id))

  const schedule = schedules.find((s) => s.agentId === agent.id && s.enabled)
  const trigger = triggers.find(
    (t) => t.agentId === agent.id && t.status === "Active"
  )
  const scheduleInfo = schedule
    ? { label: describeCron(schedule.cron), detail: schedule.description }
    : trigger
      ? { label: "Event-driven", detail: trigger.name }
      : { label: "On demand", detail: "Runs when a user starts a conversation" }

  return {
    autonomy,
    budgets: {
      dailyCostCap,
      monthToDate,
      maxTokensPerRun: agent.params.maxOutputTokens * 6 + 8000,
      budgetId: budget?.id,
    },
    guardrailIds: policies.map((g) => g.id),
    guardrails: policies.map((g) => g.name),
    knowledgeBaseIds: kbs.map((k) => k.id),
    knowledgeSources: kbs.map((k) => k.name),
    schedule: scheduleInfo,
  }
}
