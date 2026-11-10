"use client"

import * as React from "react"
import {
  ArchiveIcon,
  BellIcon,
  BellOffIcon,
  CheckIcon,
  FlagIcon,
  PencilIcon,
  Share2Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react"
import { toast } from "sonner"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  RecordOverflowMenu,
  type RecordOverflowItem,
} from "@/components/record/record-overflow-menu"
import { StateBadge } from "@/components/shared/status-badge"
import { NOW } from "@/lib/data/seed"
import { formatNumber } from "@/lib/format"
import type { KnowledgeArticle } from "@/lib/types"
import { knowledgeStore } from "./knowledge-store"

/** Current article from the client store, falling back to the server copy. */
export function useArticle(fallback: KnowledgeArticle) {
  const list = knowledgeStore.use()
  return list.find((a) => a.number === fallback.number) ?? fallback
}

export function ArticleStateBadge({ article }: { article: KnowledgeArticle }) {
  const live = useArticle(article)
  return <StateBadge state={live.state} />
}

/** Summary line under the title; follows edits made in this session. */
export function ArticleSummary({ article }: { article: KnowledgeArticle }) {
  const live = useArticle(article)
  return <>{live.summary}</>
}

export function ArticleActions({
  article: seed,
}: {
  article: KnowledgeArticle
}) {
  const article = useArticle(seed)
  const [editOpen, setEditOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [summary, setSummary] = React.useState("")
  const [retireOpen, setRetireOpen] = React.useState(false)
  const [subscribed, setSubscribed] = React.useState(false)

  const patch = (next: Partial<KnowledgeArticle>) =>
    knowledgeStore.patch(article.number, {
      ...next,
      updated: NOW.toISOString(),
    })

  async function share() {
    const url = `${window.location.origin}/itsm/knowledge/${article.number}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied", { description: url })
    } catch {
      toast.error("Clipboard unavailable", {
        description: "Copy the address bar URL instead.",
      })
    }
  }

  function openEdit() {
    setTitle(article.title)
    setSummary(article.summary)
    setEditOpen(true)
  }

  function save() {
    patch({ title: title.trim() || article.title, summary: summary.trim() })
    setEditOpen(false)
    toast.success(`${article.number} updated`, {
      description: "Title and summary saved for this session.",
    })
  }

  const overflow: RecordOverflowItem[] = [
    {
      label: subscribed ? "Unsubscribe" : "Subscribe to updates",
      icon: subscribed ? <BellOffIcon /> : <BellIcon />,
      message: subscribed
        ? `Unsubscribed from ${article.number}`
        : `Subscribed to ${article.number} in this session`,
      onSelect: () => setSubscribed((s) => !s),
    },
    {
      label: "Flag for review",
      icon: <FlagIcon />,
      disabled: article.state === "Review" || article.state === "Retired",
      message: `${article.number} moved to Review`,
      onSelect: () => patch({ state: "Review" }),
    },
    {
      label: "Retire article",
      icon: <ArchiveIcon />,
      destructive: true,
      separatorBefore: true,
      disabled: article.state === "Retired",
      onSelect: () => {
        setRetireOpen(true)
        return false
      },
    },
  ]

  return (
    <>
      <Button variant="outline" onClick={share}>
        <Share2Icon /> Share
      </Button>
      <Button onClick={openEdit} disabled={article.state === "Retired"}>
        <PencilIcon /> Edit article
      </Button>
      <RecordOverflowMenu items={overflow} number={article.number} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {article.number}</DialogTitle>
            <DialogDescription>
              Changes apply to this session only; the body of the article is
              sample copy.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="article-title">Title</FieldLabel>
              <Input
                id="article-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="article-summary">Summary</FieldLabel>
              <Textarea
                id="article-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-24"
              />
              <FieldDescription>
                Shown in search results and under the title.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!summary.trim()}>
              <CheckIcon /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={retireOpen} onOpenChange={setRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire {article.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Retired articles are hidden from search and the self-service
              portal but remain available to agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setRetireOpen(false)
                patch({ state: "Retired" })
                toast(`${article.number} retired`)
              }}
            >
              Retire article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Helpful / not helpful vote. One vote per session, click again to withdraw. */
export function HelpfulVote({ article: seed }: { article: KnowledgeArticle }) {
  const article = useArticle(seed)
  const [vote, setVote] = React.useState<"up" | "down" | null>(null)
  const votes = article.helpful + article.notHelpful
  const pct = Math.round((article.helpful / Math.max(1, votes)) * 100)

  function cast(next: "up" | "down") {
    const delta = { helpful: 0, notHelpful: 0 }
    if (vote === "up") delta.helpful -= 1
    if (vote === "down") delta.notHelpful -= 1
    const withdrawing = vote === next
    if (!withdrawing) {
      if (next === "up") delta.helpful += 1
      else delta.notHelpful += 1
    }
    knowledgeStore.patch(article.number, (a) => ({
      ...a,
      helpful: a.helpful + delta.helpful,
      notHelpful: a.notHelpful + delta.notHelpful,
    }))
    setVote(withdrawing ? null : next)
    toast(withdrawing ? "Vote withdrawn" : "Thanks for the feedback", {
      description: withdrawing
        ? undefined
        : next === "up"
          ? "Counted as helpful."
          : "Counted as not helpful; the author sees the trend.",
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant={vote === "up" ? "default" : "outline"}
          aria-pressed={vote === "up"}
          onClick={() => cast("up")}
        >
          <ThumbsUpIcon /> Yes{" "}
          <span className="tabular-nums opacity-70">
            ({formatNumber(article.helpful)})
          </span>
        </Button>
        <Button
          variant={vote === "down" ? "default" : "outline"}
          aria-pressed={vote === "down"}
          onClick={() => cast("down")}
        >
          <ThumbsDownIcon /> No{" "}
          <span className="tabular-nums opacity-70">
            ({formatNumber(article.notHelpful)})
          </span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {votes === 0
          ? "Be the first to rate this article."
          : `${pct}% of ${formatNumber(votes)} readers found this helpful.`}
      </p>
    </>
  )
}
