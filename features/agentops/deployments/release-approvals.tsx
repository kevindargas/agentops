"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  CheckCircle2Icon,
  CheckIcon,
  CircleDashedIcon,
  ClockIcon,
  FlaskConicalIcon,
  MessageSquareWarningIcon,
  ShieldCheckIcon,
  ShieldIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { RiskBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { getDeployedAgent } from "@/lib/data/agentops"
import type { Approver, Release, ReleaseApproval } from "@/lib/data/deployments"
import { clock, NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatDelta, timeAgo } from "@/lib/format"
import { recordAudit } from "../audit/audit-store"
import { AgentChip } from "../shared"
import {
  ChangeChips,
  EvalGateChip,
  StageBadge,
  VersionChip,
  strategyLabel,
} from "./shared"
import {
  approvalsFrom,
  decide,
  decisionStore,
  releaseStore,
  type ApprovalDecision,
} from "./store"

const approverMeta: Record<
  Approver["status"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  approved: {
    label: "Approved",
    icon: <CheckCircle2Icon />,
    className: "text-success-text",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircleIcon />,
    className: "text-danger-text",
  },
  "changes requested": {
    label: "Changes requested",
    icon: <MessageSquareWarningIcon />,
    className: "text-warning-text",
  },
  pending: {
    label: "Pending",
    icon: <ClockIcon />,
    className: "text-warning-text",
  },
}

function releaseTarget(release: Release, agentName: string) {
  return {
    kind: "release",
    id: release.id,
    label: `${agentName} ${release.version}`,
    href: `/agentops/deployments/${release.id}`,
  }
}

export function ReleaseApprovals() {
  const releases = releaseStore.use()
  const { decisions } = decisionStore.use()
  const approvals = approvalsFrom(releases)
  const open = approvals.filter((a) => !decisions[a.id])
  const decided = Object.keys(decisions)
    .map((id) => ({
      id,
      decision: decisions[id],
      releaseId: id.replace(/^apr-/, "rel-"),
    }))
    .filter((d) => releases.some((r) => r.id === d.releaseId))

  if (approvals.length === 0 && decided.length === 0)
    return (
      <EmptyState
        title="Nothing awaiting approval"
        description="Releases that need a sign-off show up here with their evidence."
        icon={<ShieldCheckIcon />}
      />
    )

  return (
    <div className="flex flex-col gap-4">
      {open.length === 0 ? (
        <EmptyState
          size="sm"
          title="Queue cleared"
          description="Every pending release has a decision."
          icon={<ShieldCheckIcon />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {open.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}
      {decided.length > 0 && (
        <div className="flex flex-col gap-2">
          <Eyebrow as="h3">Decided this session</Eyebrow>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {decided.map((d) => {
              const r = releases.find((x) => x.id === d.releaseId)
              const meta = approverMeta[d.decision]
              return (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                  <Link
                    href={`/agentops/deployments/${d.releaseId}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {d.releaseId}
                  </Link>
                  {r && <AgentChip agentId={r.agentId} size="sm" />}
                  {r && <VersionChip version={r.version} />}
                  {r && <StageBadge stage={r.stage} size="sm" />}
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-3.5",
                      meta.className
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function ApprovalCard({ approval }: { approval: ReleaseApproval }) {
  const releases = releaseStore.use()
  const release = releases.find((r) => r.id === approval.releaseId)
  const [dialog, setDialog] = React.useState<"reject" | "changes" | null>(null)
  const [reason, setReason] = React.useState("")
  const [touched, setTouched] = React.useState(false)
  if (!release) return null
  const agent = getDeployedAgent(release.agentId)
  const agentName = agent?.name ?? release.agentId
  const approvedCount = approval.approvers.filter(
    (x) => x.status === "approved"
  ).length
  const reasonValid = reason.trim().length >= 10
  const gate = approval.evidence.evalGate
  const gateOk = gate?.status === "passed"
  const coverageOk = approval.evidence.guardrailCoverage >= 80
  const sig = approval.evidence.experimentSignificance
  const dueHours =
    (new Date(approval.due).getTime() - NOW.getTime()) / 3_600_000

  function appendActivity(
    kind: Release["activity"][number]["kind"],
    message: string,
    patch?: Partial<Release>
  ) {
    releaseStore.patch(approval.releaseId, (r) => ({
      ...r,
      ...patch,
      activity: [
        ...r.activity,
        {
          id: `${r.id}-local-${r.activity.length}`,
          kind,
          at: clock().toISOString(),
          actorId: currentUser.id,
          message,
        },
      ],
    }))
  }

  function approve() {
    if (!release) return
    appendActivity("approval", "Approved from the approvals inbox", {
      approvers: release.approvers.map((a) =>
        a.status === "approved"
          ? a
          : { ...a, status: "approved", at: clock().toISOString() }
      ),
    })
    decide(approval.id, "approved")
    const event = recordAudit({
      action: "release.approved",
      source: "release",
      target: releaseTarget(release, agentName),
      summary: `Approved ${release.id} (${agentName} ${release.version}) with gate ${gate?.status ?? "not run"} at ${gate?.score ?? "n/a"}`,
      context: {
        agentId: release.agentId,
        releaseId: release.id,
        approvalId: approval.id,
      },
    })
    toast.success(`${release.id} approved`, {
      description: `${agentName} ${release.version} can start its ${release.strategy.toLowerCase()} rollout from the release record. Recorded as ${event.id}.`,
    })
  }

  function submit(kind: "reject" | "changes") {
    if (!release) return
    if (!reasonValid) {
      setTouched(true)
      return
    }
    setDialog(null)
    const text = reason.trim()
    const decision: ApprovalDecision =
      kind === "reject" ? "rejected" : "changes requested"
    if (kind === "reject") {
      appendActivity("note", `Rejected: ${text}`, { stage: "Draft" })
    } else {
      appendActivity("note", `Changes requested: ${text}`, {
        approvers: release.approvers.map((a) =>
          a.userId === currentUser.id
            ? { ...a, status: "changes requested", at: clock().toISOString() }
            : a
        ),
      })
    }
    decide(approval.id, decision)
    const event = recordAudit({
      action:
        kind === "reject" ? "release.rejected" : "release.changes_requested",
      source: "release",
      target: releaseTarget(release, agentName),
      summary:
        kind === "reject"
          ? `Rejected ${release.id} (${agentName} ${release.version}); release returned to Draft`
          : `Requested changes on ${release.id} (${agentName} ${release.version})`,
      before: release.stage,
      after: kind === "reject" ? "Draft" : release.stage,
      context: {
        agentId: release.agentId,
        releaseId: release.id,
        approvalId: approval.id,
        reason: text,
      },
    })
    toast(
      kind === "reject"
        ? `${release.id} rejected`
        : `Changes requested on ${release.id}`,
      {
        description: `${text} Recorded as ${event.id}.`,
      }
    )
  }

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link
            href={`/agentops/deployments/${release.id}`}
            className="font-mono text-xs text-muted-foreground hover:underline"
          >
            {release.id}
          </Link>
          <VersionChip version={release.version} />
          <StageBadge stage={release.stage} size="sm" />
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AgentChip agentId={release.agentId} size="sm" />
          <span>· {strategyLabel(release.strategy, release.steps)}</span>
          <span>· requested {timeAgo(approval.requestedAt)}</span>
        </CardDescription>
        <CardAction>
          <RiskBadge risk={approval.risk} size="sm" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <section className="flex flex-col gap-1.5">
          <Eyebrow as="h3">What</Eyebrow>
          <ChangeChips changes={release.changes} max={5} />
        </section>

        <section className="flex flex-col gap-1.5">
          <Eyebrow as="h3">Evidence</Eyebrow>
          <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <Evidence
              label="Eval gate"
              ok={gate ? gateOk : undefined}
              value={<EvalGateChip gate={gate} />}
            />
            <Evidence
              label="Guardrail coverage"
              ok={coverageOk}
              value={`${approval.evidence.guardrailCoverage}% of suite`}
            />
            <Evidence
              label="Experiment"
              ok={sig === undefined ? undefined : sig >= 0.95}
              value={
                sig === undefined ? (
                  <span className="text-muted-foreground">
                    Not derived from one
                  </span>
                ) : (
                  <Link
                    href={`/agentops/experiments?open=${release.experimentId}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <FlaskConicalIcon className="size-3" />
                    {Math.round(sig * 100)}% P(B &gt; A)
                  </Link>
                )
              }
            />
            <Evidence
              label="Cost estimate"
              ok={approval.evidence.costDeltaPct <= 10}
              value={`${formatDelta(approval.evidence.costDeltaPct, "%", 1)} per day`}
            />
          </ul>
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <h4 className="font-medium">
              {approvedCount} of {approval.approvers.length} approved
            </h4>
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums",
                dueHours < 12 ? "text-warning-text" : "text-muted-foreground"
              )}
            >
              <ClockIcon className="size-3" /> due {timeAgo(approval.due)}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {approval.approvers.map((x) => (
              <span
                key={x.userId}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  x.status === "approved" ? "bg-success" : "bg-warning/60"
                )}
              />
            ))}
          </div>
          <ul className="flex flex-col divide-y">
            {approval.approvers.map((x) => {
              const meta = approverMeta[x.status]
              return (
                <li
                  key={x.userId}
                  className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0"
                >
                  <UserChip userId={x.userId} size="xs" secondary={x.role} />
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 text-xs font-medium [&_svg]:size-3.5",
                      meta.className
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="mt-auto flex gap-2 pt-1">
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex flex-1" />}>
              <Button
                size="sm"
                className="flex-1"
                disabled={!gateOk}
                onClick={approve}
              >
                <CheckIcon /> Approve
              </Button>
            </TooltipTrigger>
            {!gateOk && (
              <TooltipContent>
                {gate
                  ? `Eval gate failed${gate.reason ? `: ${gate.reason}` : ""}. Request changes instead.`
                  : "No eval gate yet. Run a Pre-deploy eval before approving."}
              </TooltipContent>
            )}
          </Tooltip>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setReason("")
              setTouched(false)
              setDialog("changes")
            }}
          >
            <MessageSquareWarningIcon /> Request changes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reject"
            onClick={() => {
              setReason("")
              setTouched(false)
              setDialog("reject")
            }}
          >
            <XIcon />
          </Button>
        </div>
      </CardContent>

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "reject" ? "Reject" : "Request changes on"}{" "}
              {release.id}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "reject"
                ? "The release returns to Draft and the reason is posted to its activity and the audit log."
                : "Your note is posted to the release activity and the audit log; the author re-requests approval once addressed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={touched && !reasonValid ? true : undefined}>
            <FieldLabel htmlFor={`${approval.id}-reason`}>Reason</FieldLabel>
            <Textarea
              id={`${approval.id}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !reasonValid ? true : undefined}
              placeholder={
                dialog === "reject"
                  ? "e.g. Model swap needs a full eval run, not a sample"
                  : "e.g. Add a guardrail test for PII in the new tool output"
              }
              className="min-h-20"
              autoFocus
            />
            {touched && !reasonValid ? (
              <FieldError>
                Give at least 10 characters so the author knows what to fix.
              </FieldError>
            ) : (
              <FieldDescription>
                Posted to the release activity and stored as the audit reason.
              </FieldDescription>
            )}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={dialog === "reject" ? "destructive" : "default"}
              onClick={() => submit(dialog ?? "changes")}
            >
              {dialog === "reject" ? (
                <>
                  <XIcon /> Reject release
                </>
              ) : (
                <>
                  <MessageSquareWarningIcon /> Request changes
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function Evidence({
  label,
  ok,
  value,
}: {
  label: string
  ok?: boolean
  value: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg border bg-muted/30 px-2.5 py-2">
      <span
        className={cn(
          "mt-0.5 shrink-0 [&_svg]:size-3.5",
          ok === undefined
            ? "text-muted-foreground"
            : ok
              ? "text-success-text"
              : "text-danger-text"
        )}
      >
        {ok === undefined ? (
          <CircleDashedIcon />
        ) : ok ? (
          <ShieldCheckIcon />
        ) : (
          <ShieldIcon />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-2xs text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </span>
    </li>
  )
}
