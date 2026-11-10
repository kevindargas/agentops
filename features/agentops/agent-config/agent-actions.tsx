"use client"

import * as React from "react"
import Link from "next/link"
import {
  DownloadIcon,
  FlaskConicalIcon,
  PauseIcon,
  PlayIcon,
  RocketIcon,
  RouteIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { RecordOverflowMenu } from "@/components/record/record-overflow-menu"
import { StateBadge } from "@/components/shared/status-badge"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { downloadText } from "@/features/agentops/costs/shared"
import { agentStore } from "@/features/agentops/stores"
import { agentTraces } from "@/lib/data/agentops"
import type { DeployedAgent } from "@/lib/types"

/** Live `paused` state for one agent (falls back to the server value). */
export function usePaused(agent: DeployedAgent) {
  const live = agentStore.use().find((a) => a.id === agent.id)
  return {
    paused: live?.paused ?? agent.paused,
    pausedReason: live?.pausedReason ?? agent.pausedReason,
  }
}

export function resumeAgent(agent: DeployedAgent) {
  agentStore.patch(agent.id, { paused: false, pausedReason: undefined })
  toast.success(`${agent.name} resumed`, {
    description: "New runs are accepted again.",
  })
}

function applyPause(agent: DeployedAgent, reason: string) {
  const previous = agentStore.get().find((a) => a.id === agent.id)
  agentStore.patch(agent.id, {
    paused: true,
    pausedReason: reason.trim() || "Paused from the agent record",
  })
  toast(`${agent.name} paused`, {
    description:
      "No new runs are accepted. In-flight runs finish normally and schedules are skipped.",
    action: {
      label: "Undo",
      onClick: () =>
        agentStore.patch(agent.id, {
          paused: previous?.paused ?? false,
          pausedReason: previous?.pausedReason,
        }),
    },
    duration: 6000,
  })
}

/**
 * Confirmation for pausing an agent, shared by the record header and the
 * configuration panel's switch. Pausing is destructive for users of the agent,
 * so it always asks; resuming never does.
 */
export function PauseAgentDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: DeployedAgent
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [reason, setReason] = React.useState("")
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pause {agent.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The agent stops accepting new runs immediately. In-flight runs
            finish normally, schedules and triggers are skipped, and users see a
            maintenance message until you resume it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`pause-reason-${agent.id}`}>Reason (optional)</Label>
          <Textarea
            id={`pause-reason-${agent.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Shown on the agent record while paused, e.g. pending SOX control review"
            className="min-h-16 text-sm"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              applyPause(agent, reason)
              setReason("")
              onOpenChange(false)
            }}
          >
            Pause agent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Health and paused badges that follow the client store. */
export function AgentHealthBadges({ agent }: { agent: DeployedAgent }) {
  const { paused, pausedReason } = usePaused(agent)
  if (paused)
    return (
      <span title={pausedReason}>
        <StateBadge state="Paused" icon={<PauseIcon className="size-3" />} />
      </span>
    )
  return <StateBadge state={agent.health} />
}

/** Toolbar actions of the agent record. */
export function AgentActions({
  agent,
  promptHref,
}: {
  agent: DeployedAgent
  promptHref: string
}) {
  const { paused } = usePaused(agent)
  const [confirming, setConfirming] = React.useState(false)

  const exportTraces = () => {
    const rows = agentTraces.filter((t) => t.agentId === agent.id)
    downloadText(
      `${agent.id}-traces.json`,
      JSON.stringify(rows, null, 2),
      "application/json"
    )
    toast.success(`${rows.length} traces downloaded`, {
      description: `${agent.id}-traces.json`,
    })
    return false
  }

  return (
    <>
      <Button
        variant="outline"
        render={<Link href={`/agentops/traces?agent=${agent.id}`} />}
      >
        <RouteIcon /> Traces
      </Button>
      {paused ? (
        <Button onClick={() => resumeAgent(agent)}>
          <PlayIcon /> Resume
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <PauseIcon /> Pause
        </Button>
      )}
      <Button
        variant={paused ? "outline" : "default"}
        render={<Link href={`/agentops/deployments?agent=${agent.id}`} />}
      >
        <RocketIcon /> Deploy new version
      </Button>
      <RecordOverflowMenu
        number={agent.id}
        items={[
          {
            label: "Open in playground",
            icon: <SlidersHorizontalIcon />,
            href: `/agentops/playground?agent=${agent.id}`,
          },
          {
            label: "Start experiment",
            icon: <FlaskConicalIcon />,
            href: `/agentops/experiments?agent=${agent.id}`,
          },
          { label: "Edit prompt", icon: <WrenchIcon />, href: promptHref },
          {
            label: "Export traces (JSON)",
            icon: <DownloadIcon />,
            separatorBefore: true,
            onSelect: exportTraces,
          },
        ]}
      />
      <PauseAgentDialog
        agent={agent}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  )
}
