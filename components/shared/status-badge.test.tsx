import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  PriorityBadge,
  StateBadge,
  toneForState,
} from "@/components/shared/status-badge"
import { outcomeLabel } from "@/features/agentops/shared"
import {
  changeStates,
  incidentStates,
  problemStates,
  requestStates,
} from "@/lib/constants"
import type { BudgetStatus } from "@/lib/data/costs"
import type { EvalGateStatus, ReleaseStage } from "@/lib/data/deployments"
import type { EvalRunStatus } from "@/lib/data/evals"
import type {
  GuardrailMode,
  GuardrailStatus,
  ViolationAction,
  ViolationSeverity,
  ViolationVerdict,
} from "@/lib/data/guardrails"
import type {
  IngestionJobStatus,
  KbSourceStatus,
  KbStatus,
  LowRecallOutcome,
} from "@/lib/data/knowledge"
import type { PromptLabel, PromptReviewState } from "@/lib/data/prompts"
import type {
  ApiKeyStatus,
  ProviderStatus,
  RoutingStatus,
} from "@/lib/data/providers"
import type {
  RunStatus,
  SecretStatus,
  TriggerStatus,
} from "@/lib/data/schedules"
import type { McpStatus, ToolStatus } from "@/lib/data/tools"
import type {
  AgentHealth,
  AlertState,
  ApprovalState,
  ChangeRisk,
  DriftSeverity,
  DriftState,
  ExperimentStatus,
  KnowledgeState,
  RecommendationStatus,
  RequestStage,
  ReviewStatus,
  SemanticStatus,
  TraceStatus,
} from "@/lib/types"

/**
 * `satisfies Record<Union, true>` makes the compiler reject this file as soon
 * as a union gains a member that is not listed here, so every status string
 * in the type layer is guaranteed to have a tone.
 */
const keys = <T extends string>(record: Record<T, true>) =>
  Object.keys(record) as T[]

const unions: Record<string, string[]> = {
  incidentStates: [...incidentStates],
  problemStates: [...problemStates],
  changeStates: [...changeStates],
  requestStates: [...requestStates],
  RequestStage: keys({
    "Waiting for Approval": true,
    Fulfillment: true,
    Delivery: true,
    Completed: true,
    Cancelled: true,
  } satisfies Record<RequestStage, true>),
  ApprovalState: keys({
    "Not Yet Requested": true,
    Requested: true,
    Approved: true,
    Rejected: true,
  } satisfies Record<ApprovalState, true>),
  KnowledgeState: keys({
    Draft: true,
    Review: true,
    Published: true,
    Retired: true,
  } satisfies Record<KnowledgeState, true>),
  AlertState: keys({
    Open: true,
    Reopen: true,
    Flapping: true,
    Closed: true,
  } satisfies Record<AlertState, true>),
  ChangeRisk: keys({
    Low: true,
    Moderate: true,
    High: true,
    "Very High": true,
  } satisfies Record<ChangeRisk, true>),
  AgentHealth: keys({
    Healthy: true,
    Degraded: true,
    Drifting: true,
    Paused: true,
  } satisfies Record<AgentHealth, true>),
  TraceStatus: keys({
    Succeeded: true,
    Failed: true,
    "Needs review": true,
    Reviewed: true,
  } satisfies Record<TraceStatus, true>),
  ReviewStatus: keys({
    Pending: true,
    Approved: true,
    Flagged: true,
    Corrected: true,
  } satisfies Record<ReviewStatus, true>),
  DriftSeverity: keys({
    Info: true,
    Warning: true,
    Critical: true,
  } satisfies Record<DriftSeverity, true>),
  DriftState: keys({
    Open: true,
    Acknowledged: true,
    Resolved: true,
  } satisfies Record<DriftState, true>),
  ExperimentStatus: keys({
    Draft: true,
    Running: true,
    Completed: true,
    Promoted: true,
    Stopped: true,
  } satisfies Record<ExperimentStatus, true>),
  RecommendationStatus: keys({
    New: true,
    Testing: true,
    Applied: true,
    Dismissed: true,
  } satisfies Record<RecommendationStatus, true>),
  SemanticStatus: keys({
    Verified: true,
    Draft: true,
    "Needs review": true,
    Deprecated: true,
  } satisfies Record<SemanticStatus, true>),
  ReleaseStage: keys({
    Draft: true,
    "Pending approval": true,
    Canary: true,
    Progressing: true,
    Promoted: true,
    "Rolled back": true,
    Failed: true,
  } satisfies Record<ReleaseStage, true>),
  EvalGateStatus: keys({
    passed: true,
    failed: true,
    pending: true,
  } satisfies Record<EvalGateStatus, true>),
  EvalRunStatus: keys({
    Passed: true,
    Failed: true,
    Running: true,
    Queued: true,
    Cancelled: true,
  } satisfies Record<EvalRunStatus, true>),
  GuardrailMode: keys({
    Block: true,
    Flag: true,
    Redact: true,
    "Require approval": true,
  } satisfies Record<GuardrailMode, true>),
  GuardrailStatus: keys({
    Active: true,
    Disabled: true,
    Draft: true,
  } satisfies Record<GuardrailStatus, true>),
  ViolationAction: keys({
    Blocked: true,
    Flagged: true,
    Redacted: true,
    "Approval requested": true,
  } satisfies Record<ViolationAction, true>),
  ViolationSeverity: keys({
    Critical: true,
    Warning: true,
    Info: true,
  } satisfies Record<ViolationSeverity, true>),
  ViolationVerdict: keys({
    Verified: true,
    Dismissed: true,
    Pending: true,
  } satisfies Record<ViolationVerdict, true>),
  KbStatus: keys({
    Healthy: true,
    Syncing: true,
    Stale: true,
    Error: true,
  } satisfies Record<KbStatus, true>),
  KbSourceStatus: keys({
    Synced: true,
    Running: true,
    Failed: true,
    Paused: true,
  } satisfies Record<KbSourceStatus, true>),
  IngestionJobStatus: keys({
    Queued: true,
    Running: true,
    Completed: true,
    Failed: true,
  } satisfies Record<IngestionJobStatus, true>),
  LowRecallOutcome: keys({
    "Fallback answer": true,
    "Escalated to human": true,
    "Hallucination flagged": true,
    "No answer": true,
    "Answered from memory": true,
  } satisfies Record<LowRecallOutcome, true>),
  PromptLabel: keys({
    production: true,
    staging: true,
    draft: true,
    archived: true,
  } satisfies Record<PromptLabel, true>),
  PromptReviewState: keys({
    Approved: true,
    "Pending Approval": true,
    Rejected: true,
  } satisfies Record<PromptReviewState, true>),
  ProviderStatus: keys({
    Connected: true,
    Degraded: true,
    Disconnected: true,
  } satisfies Record<ProviderStatus, true>),
  ApiKeyStatus: keys({
    Active: true,
    Expiring: true,
    Revoked: true,
    Rotating: true,
  } satisfies Record<ApiKeyStatus, true>),
  RoutingStatus: keys({
    Active: true,
    Paused: true,
    Draft: true,
  } satisfies Record<RoutingStatus, true>),
  RunStatus: keys({
    Succeeded: true,
    Failed: true,
    Running: true,
    Skipped: true,
  } satisfies Record<RunStatus, true>),
  TriggerStatus: keys({
    Active: true,
    Paused: true,
    Error: true,
  } satisfies Record<TriggerStatus, true>),
  SecretStatus: keys({
    Valid: true,
    Rotating: true,
    Missing: true,
  } satisfies Record<SecretStatus, true>),
  ToolStatus: keys({
    Active: true,
    Deprecated: true,
    Disabled: true,
  } satisfies Record<ToolStatus, true>),
  McpStatus: keys({
    Connected: true,
    Degraded: true,
    Disconnected: true,
  } satisfies Record<McpStatus, true>),
  BudgetStatus: keys({
    "On track": true,
    "At risk": true,
    Exceeded: true,
  } satisfies Record<BudgetStatus, true>),
  outcomeLabel: Object.values(outcomeLabel),
}

describe("StateBadge", () => {
  it("renders the state text with a tone class", () => {
    render(<StateBadge state="In Progress" />)
    const badge = screen.getByText("In Progress")
    expect(badge.closest("[data-slot]") ?? badge).toBeInTheDocument()
    expect((badge.closest("span") ?? badge).className).toMatch(/brand|progress/)
  })

  it("falls back to a neutral tone for unknown states instead of throwing", () => {
    render(<StateBadge state="Totally New State" />)
    expect(screen.getByText("Totally New State")).toBeInTheDocument()
    expect(toneForState("Totally New State")).toBe("neutral")
  })

  describe("stateTone covers every status vocabulary", () => {
    for (const [name, values] of Object.entries(unions)) {
      it(name, () => {
        expect(values.length).toBeGreaterThan(0)
        for (const value of values) {
          expect(toneForState(value), `${name}: "${value}"`).not.toBe("neutral")
        }
      })
    }
  })
})

describe("PriorityBadge", () => {
  it("labels priorities", () => {
    render(<PriorityBadge priority={1} />)
    expect(screen.getByText(/P1/)).toBeInTheDocument()
  })
})
