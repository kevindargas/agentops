"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardCheckIcon, FlaskConicalIcon } from "lucide-react"
import { toast } from "sonner"

import { RecordOverflowMenu } from "@/components/record/record-overflow-menu"
import { Button } from "@/components/ui/button"
import type { AgentTrace } from "@/lib/types"
import { queueTraceForReview, reviewStore } from "./stores"

/**
 * Header actions of a trace record. Client-side so "Send to review" writes a
 * real item into the shared review store and "Copy trace JSON" writes to the
 * clipboard; the server page only passes the trace.
 */
export function TraceActions({
  trace,
  experimentId,
  evalDataset,
  promptId,
}: {
  trace: AgentTrace
  experimentId?: string
  evalDataset?: string
  promptId?: string
}) {
  const router = useRouter()
  const review = reviewStore.use().find((r) => r.traceId === trace.id)

  const sendToReview = () => {
    const { item, created } = queueTraceForReview(trace)
    toast.success(
      created
        ? `${trace.id} added to the review queue`
        : "Already in the queue",
      {
        description: created
          ? "Pending for the current session, assigned to you"
          : `Item ${item.id} is ${item.status.toLowerCase()}`,
        action: {
          label: "Open queue",
          onClick: () => router.push(`/agentops/reviews?item=${item.id}`),
        },
      }
    )
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(trace, null, 2))
      toast.success("Trace JSON copied", {
        description: `${trace.spans.length} spans, lineage and streaming detail`,
      })
    } catch {
      toast.error("Clipboard unavailable", {
        description: "Copying needs a secure context (https or localhost).",
      })
    }
  }

  return (
    <>
      {review ? (
        <Button
          variant="outline"
          render={<Link href={`/agentops/reviews?item=${review.id}`} />}
        >
          <ClipboardCheckIcon /> In review queue · {review.status}
        </Button>
      ) : (
        <Button variant="outline" onClick={sendToReview}>
          <ClipboardCheckIcon /> Send to review
        </Button>
      )}
      {experimentId && (
        <Button
          render={<Link href={`/agentops/experiments?open=${experimentId}`} />}
        >
          <FlaskConicalIcon /> Variant {trace.variant}
        </Button>
      )}
      <RecordOverflowMenu
        number={trace.id}
        items={[
          {
            label: "Replay in playground",
            href: `/agentops/playground?agent=${trace.agentId}`,
          },
          {
            label: "Open golden set",
            href: evalDataset
              ? `/agentops/evals?tab=datasets&dataset=${evalDataset}`
              : "/agentops/evals?tab=datasets",
          },
          ...(promptId
            ? [{ label: "Open prompt", href: `/agentops/prompts/${promptId}` }]
            : []),
          {
            label: "Copy trace JSON",
            separatorBefore: true,
            onSelect: () => {
              void copyJson()
              return false
            },
          },
        ]}
      />
    </>
  )
}
