"use client"

import Link from "next/link"
import { ArrowRightIcon, SparklesIcon } from "lucide-react"

import { AgentAvatar } from "@/components/ai/agent-card"
import { useAi } from "@/components/ai/ai-provider"
import { ProposalCard } from "@/components/ai/proposal-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const PREVIEW = 3

/** Dashboard card: the top proposals waiting for a human, with one-click decisions. */
export function AgentProposalsCard() {
  const { proposals, decide, agents, setOpen, setTab } = useAi()
  if (proposals.length === 0) return null
  const active = agents.filter((a) => a.enabled)
  const proposing = Array.from(new Set(proposals.map((p) => p.agentId)))
  const remaining = proposals.length - PREVIEW

  return (
    <Card className="border-brand/20 bg-linear-to-br from-brand/6 via-transparent to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-brand/10 text-brand">
            <SparklesIcon className="size-3.5" />
          </span>
          Agent proposals
          <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-foreground tabular-nums">
            {proposals.length}
          </span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-1.5">
          <span className="inline-flex -space-x-1">
            {proposing.slice(0, 4).map((id) => (
              <AgentAvatar
                key={id}
                agentId={id}
                size="xs"
                className="rounded-full ring-2 ring-card"
              />
            ))}
          </span>
          <span>
            {active.length} agents working · {proposals.length} action
            {proposals.length === 1 ? "" : "s"} waiting for your approval
          </span>
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTab("queue")
              setOpen(true)
            }}
          >
            Review in Assist
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/ai" />}>
            Control center <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {proposals.slice(0, PREVIEW).map((p) => (
          <ProposalCard key={p.id} proposal={p} onDecide={decide} compact />
        ))}
      </CardContent>
      {remaining > 0 && (
        <CardFooter className="justify-between py-2.5 text-xs text-muted-foreground">
          <span>
            {remaining} more proposal{remaining === 1 ? "" : "s"} in the queue
          </span>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            View all <ArrowRightIcon className="size-3" />
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}
