"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { setQueryParams } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
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
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getDeployedAgent } from "@/lib/data/agentops"
import type { Prompt, PromptVersion } from "@/lib/data/prompts"
import { DiffTab } from "./diff-tab"
import { EditorTab } from "./editor-tab"
import { promptStore, setVersionLabel } from "./prompt-store"
import { LabelBadge, VersionTag } from "./shared"
import { UsageTab } from "./usage-tab"
import { VersionsTab } from "./versions-tab"

const tabKeys = ["versions", "editor", "diff", "usage"] as const
export type PromptTabKey = (typeof tabKeys)[number]

function isTab(v: string | null): v is PromptTabKey {
  return tabKeys.includes(v as PromptTabKey)
}

/** Sensible default pair: production to newest non-production, else last two. */
function defaultDiffPair(versions: PromptVersion[]): [string, string] {
  const prod = versions.find((v) => v.label === "production")
  const latest = versions[versions.length - 1]
  if (prod && latest && prod.id !== latest.id) return [prod.id, latest.id]
  const prev = versions[versions.length - 2] ?? latest
  return [prev.id, latest.id]
}

type Pending = { kind: "promote" | "rollback"; version: PromptVersion }

/**
 * Lower half of the prompt record. Reads versions from the shared prompt
 * store so promote, rollback and drafts from the Playground are reflected in
 * every tab, and mirrors the active tab and selected version to `?tab=` and
 * `?version=` so links can land on a specific version.
 */
export function PromptWorkspace({ prompt }: { prompt: Prompt }) {
  const params = useSearchParams()
  const versions = prompt.versions
  const versionParam = params.get("version")
  const tabParam = params.get("tab")
  const tab: PromptTabKey = isTab(tabParam)
    ? tabParam
    : versionParam
      ? "editor"
      : "versions"
  const editorId =
    (versionParam && versions.some((v) => v.id === versionParam)
      ? versionParam
      : undefined) ??
    versions.find((v) => v.label === "production")?.id ??
    versions[versions.length - 1]?.id ??
    ""
  const [diff, setDiff] = React.useState<[string, string]>(() =>
    defaultDiffPair(versions)
  )
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [note, setNote] = React.useState("")
  const agent = getDeployedAgent(prompt.agentId)

  const confirm = () => {
    if (!pending) return
    const { kind, version } = pending
    const trimmed = note.trim()
    setVersionLabel(prompt.id, version.id, "production")
    if (trimmed)
      promptStore.patch(prompt.id, (p) => ({
        ...p,
        versions: p.versions.map((v) =>
          v.id === version.id
            ? {
                ...v,
                changeNote: `${v.changeNote} · Promotion note: ${trimmed}`,
              }
            : v
        ),
      }))
    if (kind === "promote")
      toast.success(`v${version.number} promoted to production`, {
        description: `${agent?.name ?? "The agent"} serves ${version.id} from the next request in this session. The previous production version was archived.`,
      })
    else
      toast(`Rolled back to v${version.number}`, {
        description: `${version.id} is production again. The replaced version was archived, not deleted.`,
      })
    setPending(null)
    setNote("")
  }

  const stage = (v: PromptVersion) => {
    setVersionLabel(prompt.id, v.id, "staging")
    toast(`v${v.number} marked as staging`, {
      description:
        "Candidate under evaluation. Promote it once the eval score is in.",
    })
  }

  const archive = (v: PromptVersion) => {
    setVersionLabel(prompt.id, v.id, "archived")
    toast(`v${v.number} archived`, {
      description: "Still available for rollback from the Versions tab.",
    })
  }

  const compare = (v: PromptVersion) => {
    const prod = versions.find((x) => x.label === "production")
    const base =
      prod && prod.id !== v.id
        ? prod
        : versions[versions.findIndex((x) => x.id === v.id) - 1]
    setDiff(base ? [base.id, v.id] : [v.id, v.id])
    setQueryParams({ tab: "diff" })
  }

  const production = versions.find((v) => v.label === "production")

  const tabs: { value: PromptTabKey; label: string; count?: number }[] = [
    { value: "versions", label: "Versions", count: versions.length },
    { value: "editor", label: "Editor" },
    { value: "diff", label: "Diff" },
    { value: "usage", label: "Usage" },
  ]

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setQueryParams({ tab: v === "versions" ? null : String(v) })
        }
        className="gap-4"
      >
        <div className="-mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6">
          <TabsList
            variant="line"
            className="h-9 w-full min-w-max justify-start gap-0 border-b p-0"
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
              >
                {t.label}
                {t.count !== undefined && (
                  <CountPill
                    count={t.count}
                    className="transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="versions">
          <VersionsTab
            versions={versions}
            agentId={prompt.agentId}
            highlightId={versionParam}
            onPromote={(v) => setPending({ kind: "promote", version: v })}
            onRollback={(v) => setPending({ kind: "rollback", version: v })}
            onStage={stage}
            onArchive={archive}
            onCompare={compare}
          />
        </TabsContent>
        <TabsContent value="editor">
          <EditorTab
            prompt={prompt}
            versions={versions}
            versionId={editorId}
            onVersionChange={(id) =>
              setQueryParams({ tab: "editor", version: id })
            }
          />
        </TabsContent>
        <TabsContent value="diff">
          <DiffTab
            versions={versions}
            fromId={diff[0]}
            toId={diff[1]}
            onChange={(a, b) => setDiff([a, b])}
          />
        </TabsContent>
        <TabsContent value="usage">
          <UsageTab versions={versions} />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null)
            setNote("")
          }
        }}
      >
        <AlertDialogContent>
          {pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending.kind === "promote"
                    ? `Promote v${pending.version.number} to production?`
                    : `Roll back to v${pending.version.number}?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {agent?.name ?? "The agent"} switches from{" "}
                  {production ? (
                    <>
                      <VersionTag version={production} /> (
                      {production.evalScore === null
                        ? "not evaluated"
                        : `eval ${production.evalScore.toFixed(1)}`}
                      )
                    </>
                  ) : (
                    "no production version"
                  )}{" "}
                  to <VersionTag version={pending.version} /> (
                  {pending.version.evalScore === null
                    ? "not evaluated yet"
                    : `eval ${pending.version.evalScore.toFixed(1)}`}
                  ). The replaced version is archived, not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <LabelBadge label={pending.version.label} size="sm" />
                <span>{pending.version.changeNote}</span>
              </div>
              {pending.version.evalScore === null && (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-text">
                  This version has not been evaluated against the golden set.
                  Run evals before promoting unless this is a rollback to a
                  known-good version.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promotion-note" className="text-xs">
                  Change note (optional)
                </Label>
                <Textarea
                  id="promotion-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this version, and what you checked"
                  rows={2}
                  className="text-sm"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirm}>
                  {pending.kind === "promote" ? "Promote" : "Roll back"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
