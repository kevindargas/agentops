"use client"

import * as React from "react"
import { cn } from "cn"
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BracesIcon,
  CameraIcon,
  CheckCheckIcon,
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  GitCompareIcon,
  GlobeIcon,
  HistoryIcon,
  Link2Icon,
  LockIcon,
  PrinterIcon,
  RotateCcwIcon,
  Settings2Icon,
  ShieldCheckIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyValue } from "@/components/data-table"
import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { DeltaPill } from "@/components/shared/stat-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { getUser } from "@/lib/data/users"
import { formatDateTime } from "@/lib/format"
import {
  decodeShareHash,
  diffAssessments,
  parseAssessment,
  SHARE_LINK_WARN_CHARS,
  shareUrl,
  toCsv,
  toJson,
  toMarkdown,
} from "@/lib/readiness/codec"
import { defaultControlSet } from "@/lib/readiness/controls"
import { maturityTargetLabel, systemTypeLabel } from "@/lib/readiness/labels"
import {
  consensusStatus,
  evaluateAssessment,
  voteSpread,
} from "@/lib/readiness/scoring"
import { BEFORE_IMPORT_LABEL, readinessActions } from "@/lib/readiness/store"
import type {
  Assessment,
  AssessmentResult,
  ControlSet,
  ControlStatus,
  Snapshot,
} from "@/lib/readiness/types"
import { copyText, downloadText, slug } from "./download"
import {
  ControlStatusBadge,
  scoreTextClass,
  scoreTone,
  useReadiness,
} from "./shared"

/* ------------------------------------------------------------------------ */
/* Helpers (event handlers only: nothing here runs during render)           */
/* ------------------------------------------------------------------------ */

function readFileText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Accepts raw JSON, a full share URL or just the `#s=…` fragment. Every
 * failure names what was wrong so the user can fix the input.
 */
function parseImport(text: string, controlSet: ControlSet): Assessment {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Paste an assessment first.")
  let parsed: Assessment
  if (/(^|[#&?])s=/.test(trimmed)) {
    const hash = trimmed.startsWith("s=") ? `#${trimmed}` : trimmed
    parsed = decodeShareHash(hash)
  } else {
    let json: unknown
    try {
      json = JSON.parse(trimmed)
    } catch {
      throw new Error(
        "Not valid JSON and not a share link. Paste the exported .json contents or a URL containing #s=."
      )
    }
    parsed = parseAssessment(json)
  }
  const known = new Set(controlSet.controls.map((c) => c.id))
  const unknown = Object.keys(parsed.responses).filter((id) => !known.has(id))
  if (unknown.length > 0)
    throw new Error(
      `${unknown.length} response${unknown.length === 1 ? "" : "s"} reference control ids missing from ${controlSet.name} v${controlSet.version}: ${unknown.slice(0, 4).join(", ")}${unknown.length > 4 ? ` and ${unknown.length - 4} more` : ""}. Import the matching control set under Customization first.`
    )
  if (
    parsed.controlSetId !== "unknown" &&
    parsed.controlSetId !== controlSet.id
  )
    throw new Error(
      `The assessment was answered against control set "${parsed.controlSetId}" but "${controlSet.id}" is active. Import that control set first or export the assessment from the same catalog.`
    )
  return parsed
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

const controlKeys = [
  "id",
  "domain",
  "title",
  "risk",
  "requiredAt",
  "frameworks",
  "tools",
] as const

function parseControlSet(input: unknown): ControlSet {
  if (!isRecord(input)) throw new Error("Not a control set object.")
  for (const k of ["id", "name", "version"] as const)
    if (typeof input[k] !== "string")
      throw new Error(`Missing string field "${k}".`)
  if (!Array.isArray(input.domains) || input.domains.length === 0)
    throw new Error('"domains" must be a non-empty array.')
  if (!Array.isArray(input.controls) || input.controls.length === 0)
    throw new Error('"controls" must be a non-empty array.')
  input.controls.forEach((c, i) => {
    if (!isRecord(c)) throw new Error(`Control #${i + 1} is not an object.`)
    for (const k of controlKeys)
      if (c[k] === undefined)
        throw new Error(
          `Control ${typeof c.id === "string" ? c.id : `#${i + 1}`} is missing "${k}".`
        )
    if (!Array.isArray(c.tools))
      throw new Error(`Control ${String(c.id)}: "tools" must be an array.`)
    if (!isRecord(c.frameworks))
      throw new Error(
        `Control ${String(c.id)}: "frameworks" must be an object.`
      )
  })
  return input as unknown as ControlSet
}

const statusOrder: ControlStatus[] = [
  "none",
  "planned",
  "partial",
  "in-place",
  "verified",
]

/* ------------------------------------------------------------------------ */
/* Section shell                                                             */
/* ------------------------------------------------------------------------ */

function Section({
  icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function SetupRequired({ what }: { what: string }) {
  return (
    <EmptyState
      size="sm"
      bare
      title="No assessment yet"
      description={`Complete Setup to ${what}.`}
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Export                                                                    */
/* ------------------------------------------------------------------------ */

const PRINT_STYLE = `@media print {
  html[data-print="report"] [data-slot="sidebar"],
  html[data-print="report"] [data-slot="sidebar-container"],
  html[data-print="report"] header { display: none !important; }
}`

function ExportSection({
  assessment,
  result,
  controlSet,
  onBeforePrint,
}: {
  assessment: Assessment | null
  result: AssessmentResult | null
  controlSet: ControlSet
  onBeforePrint?: () => void
}) {
  function print() {
    onBeforePrint?.()
    document.documentElement.setAttribute("data-print", "report")
    // Let the parent switch to the Results tab and paint before the dialog.
    window.setTimeout(() => {
      window.print()
      document.documentElement.removeAttribute("data-print")
    }, 150)
  }

  return (
    <Section
      icon={<DownloadIcon />}
      title="Export"
      description="Download the assessment for a ticket, a wiki page or an auditor. Markdown includes the scored report; CSV is one row per control."
    >
      <style>{PRINT_STYLE}</style>
      {!assessment || !result ? (
        <SetupRequired what="export a report" />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                `${slug(assessment.name)}-readiness.json`,
                toJson(assessment),
                "application/json"
              )
            }
          >
            <BracesIcon /> JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                `${slug(assessment.name)}-readiness.md`,
                toMarkdown(
                  assessment,
                  result,
                  controlSet,
                  (id) => getUser(id)?.name ?? id ?? ""
                ),
                "text/markdown"
              )
            }
          >
            <FileTextIcon /> Markdown
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                `${slug(assessment.name)}-readiness.csv`,
                toCsv(assessment, result),
                "text/csv"
              )
            }
          >
            <FileSpreadsheetIcon /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={print}>
            <PrinterIcon /> PDF / print
          </Button>
        </div>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Share link                                                                */
/* ------------------------------------------------------------------------ */

function ShareLinkSection({ assessment }: { assessment: Assessment | null }) {
  const link = React.useMemo(
    () => (assessment ? shareUrl(assessment) : ""),
    [assessment]
  )
  const tooLong = link.length > SHARE_LINK_WARN_CHARS
  return (
    <Section
      icon={<Link2Icon />}
      title="Share link"
      description="Send the current state to a colleague. Opening the link loads it into their browser; if they already have an assessment they are asked before it is replaced."
    >
      {!assessment ? (
        <SetupRequired what="generate a share link" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={link}
              aria-label="Share link"
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <CopyButton value={link} label="Copy link" size="icon-sm" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {link.length.toLocaleString("en-US")} characters. State is
              URL-encoded in the fragment (
              <code className="font-mono">#s=…</code>); nothing is sent to a
              server.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                copyText(
                  shareUrl(assessment),
                  "Share link copied",
                  "The full URL is on your clipboard. It holds every answer, owner and note."
                )
              }
            >
              <CopyIcon /> Copy link
            </Button>
          </div>
          {tooLong && (
            <Alert>
              <AlertTriangleIcon />
              <AlertTitle>
                Long link ({link.length.toLocaleString("en-US")} characters)
              </AlertTitle>
              <AlertDescription>
                Links over {SHARE_LINK_WARN_CHARS.toLocaleString("en-US")}{" "}
                characters are cut off by some chat clients and proxies. Export
                JSON instead, or trim notes and evidence before sharing.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Import                                                                    */
/* ------------------------------------------------------------------------ */

function ImportSection({
  controlSet,
  hasAssessment,
}: {
  controlSet: ControlSet
  hasAssessment: boolean
}) {
  const [text, setText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<Assessment | null>(null)
  const [confirmReplace, setConfirmReplace] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function tryParse(source: string) {
    try {
      setPreview(parseImport(source, controlSet))
      setError(null)
    } catch (e) {
      setPreview(null)
      setError(e instanceof Error ? e.message : "Could not parse input.")
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const content = await readFileText(file)
      setText(content)
      tryParse(content)
    } catch {
      setError(
        "The file could not be read. Pick a UTF-8 .json file exported from this page."
      )
    } finally {
      e.target.value = ""
    }
  }

  function clear() {
    setText("")
    setPreview(null)
    setError(null)
  }

  return (
    <Section
      icon={<UploadIcon />}
      title="Import"
      description="Paste an exported JSON file or a share link, or pick a .json file. You get a preview before anything is replaced."
    >
      <Field>
        <FieldLabel htmlFor="readiness-import">JSON or share link</FieldLabel>
        <Textarea
          id="readiness-import"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"name": "…", "profile": {…}} or https://…#s=…'
          rows={5}
          className="font-mono text-xs"
          aria-invalid={Boolean(error)}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!text.trim()}
          onClick={() => tryParse(text)}
        >
          Preview
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon /> Choose .json file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Import assessment file"
          onChange={onFile}
        />
        {(text || preview) && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
      {preview && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <DetailList
            dense
            columns={3}
            items={[
              { label: "Name", value: preview.name },
              { label: "System", value: preview.profile.name },
              {
                label: "Type",
                value: systemTypeLabel[preview.profile.systemType],
              },
              { label: "Target", value: maturityTargetLabel[preview.target] },
              {
                label: "Responses",
                value: Object.keys(preview.responses).length,
              },
              { label: "Updated", value: formatDateTime(preview.updatedAt) },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (hasAssessment) {
                  setConfirmReplace(true)
                  return
                }
                readinessActions.load(preview)
                toast("Assessment loaded", { description: preview.name })
                clear()
              }}
            >
              {hasAssessment ? "Replace current assessment" : "Load assessment"}
            </Button>
            <AlertDialog
              open={confirmReplace}
              onOpenChange={(o) => !o && setConfirmReplace(false)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Replace the current assessment?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The current answers are saved first as the snapshot{" "}
                    <span className="font-medium text-foreground">
                      {BEFORE_IMPORT_LABEL}
                    </span>
                    , then {preview.name} with{" "}
                    {Object.keys(preview.responses).length} responses becomes
                    the working assessment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      readinessActions.replace(preview, BEFORE_IMPORT_LABEL)
                      toast("Assessment replaced", {
                        description: `${preview.name} loaded; the previous assessment was saved as the snapshot "${BEFORE_IMPORT_LABEL}".`,
                      })
                      setConfirmReplace(false)
                      clear()
                    }}
                  >
                    Snapshot and replace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                readinessActions.addSnapshot({
                  id: `snap-${preview.id}-${preview.updatedAt}`,
                  label: preview.name,
                  takenAt: preview.updatedAt,
                  assessment: preview,
                })
                toast("Snapshot added", { description: preview.name })
                clear()
              }}
            >
              <CameraIcon /> Add as snapshot
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* History & compare                                                         */
/* ------------------------------------------------------------------------ */

function CompareView({
  snapshot,
  assessment,
  result,
  controlSet,
}: {
  snapshot: Snapshot
  assessment: Assessment
  result: AssessmentResult
  controlSet: ControlSet
}) {
  const before = React.useMemo(
    () => evaluateAssessment(snapshot.assessment, controlSet),
    [snapshot, controlSet]
  )
  const diff = React.useMemo(
    () => diffAssessments(snapshot.assessment, assessment),
    [snapshot, assessment]
  )
  const titleById = React.useMemo(
    () => new Map(controlSet.controls.map((c) => [c.id, c.title])),
    [controlSet]
  )
  const improved = diff.changed.filter((c) => c.direction === "up").length
  const regressed = diff.changed.length - improved

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <GitCompareIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">{snapshot.label}</span>
        <span className="text-muted-foreground">
          ({formatDateTime(snapshot.takenAt)}) → current
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1 text-success-text">
            <ArrowUpIcon className="size-3" /> {improved} improved
          </Badge>
          <Badge variant="outline" className="gap-1 text-danger-text">
            <ArrowDownIcon className="size-3" /> {regressed} regressed
          </Badge>
        </span>
      </div>
      {(diff.profileChanged || diff.targetChanged) && (
        <Alert>
          <Settings2Icon />
          <AlertTitle>Scope changed between the two</AlertTitle>
          <AlertDescription>
            {[
              diff.profileChanged && "the system profile",
              diff.targetChanged &&
                `the maturity target (${maturityTargetLabel[snapshot.assessment.target]} → ${maturityTargetLabel[assessment.target]})`,
            ]
              .filter(Boolean)
              .join(" and ")}{" "}
            differ, so applicability and required controls are not directly
            comparable.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Status changes
          </p>
          {diff.changed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No control changed status.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableCaption className="sr-only">
                  Controls whose status changed since {snapshot.label}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.changed.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-xs">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {c.id}
                        </span>
                        <span className="truncate">
                          {titleById.get(c.id) ?? "Unknown control"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ControlStatusBadge status={c.from} size="sm" />
                      </TableCell>
                      <TableCell>
                        <ControlStatusBadge status={c.to} size="sm" />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-xs font-medium",
                          c.direction === "up"
                            ? "text-success-text"
                            : "text-danger-text"
                        )}
                      >
                        {c.direction === "up" ? "↑ up" : "↓ down"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Domain scores
          </p>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableCaption className="sr-only">
                Domain scores before and after {snapshot.label}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="font-medium">
                  <TableCell>Overall</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {before.overall}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      scoreTextClass[scoreTone(result.overall)]
                    )}
                  >
                    {result.overall}
                  </TableCell>
                  <TableCell className="text-right">
                    <ScoreDelta from={before.overall} to={result.overall} />
                  </TableCell>
                </TableRow>
                {result.domains.map((d) => {
                  const prev = before.domains.find(
                    (x) => x.domain.id === d.domain.id
                  )
                  return (
                    <TableRow key={d.domain.id}>
                      <TableCell>{d.domain.short}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {prev ? prev.score : <EmptyValue />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.score}
                      </TableCell>
                      <TableCell className="text-right">
                        {prev ? (
                          <ScoreDelta from={prev.score} to={d.score} />
                        ) : (
                          <EmptyValue />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScoreDelta({ from, to }: { from: number; to: number }) {
  const d = to - from
  return (
    <DeltaPill
      direction={d > 0 ? "up" : d < 0 ? "down" : "flat"}
      good={d === 0 ? undefined : d > 0}
      text={`${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)}`}
    />
  )
}

function HistorySection({
  assessment,
  result,
  snapshots,
  controlSet,
}: {
  assessment: Assessment | null
  result: AssessmentResult | null
  snapshots: Snapshot[]
  controlSet: ControlSet
}) {
  const [label, setLabel] = React.useState("")
  const [compareId, setCompareId] = React.useState<string | null>(null)
  const scored = React.useMemo(
    () =>
      snapshots.map((s) => ({
        snapshot: s,
        overall: evaluateAssessment(s.assessment, controlSet).overall,
      })),
    [snapshots, controlSet]
  )
  const comparing = snapshots.find((s) => s.id === compareId) ?? null

  return (
    <Section
      icon={<HistoryIcon />}
      title="History & compare"
      description="Snapshots freeze the current answers so you can show progress between reviews. Up to 25 are kept."
    >
      {!assessment || !result ? (
        <SetupRequired what="take snapshots" />
      ) : (
        <>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              readinessActions.snapshot(label)
              toast("Snapshot taken", {
                description: label.trim() || "Unnamed snapshot",
              })
              setLabel("")
            }}
          >
            <Field className="min-w-56 flex-1">
              <FieldLabel htmlFor="snapshot-label">Snapshot label</FieldLabel>
              <Input
                id="snapshot-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Pilot exit review"
              />
            </Field>
            <Button type="submit" size="default">
              <CameraIcon /> Take snapshot
            </Button>
          </form>
          {scored.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No snapshots yet. Take one before a review so you can compare
              afterwards.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {scored.map(({ snapshot, overall }) => {
                const d = result.overall - overall
                const active = compareId === snapshot.id
                return (
                  <li
                    key={snapshot.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2",
                      active && "bg-muted/40"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {snapshot.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(snapshot.takenAt)} ·{" "}
                        {maturityTargetLabel[snapshot.assessment.target]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          scoreTextClass[scoreTone(overall)]
                        )}
                      >
                        {overall}
                      </span>
                      <DeltaPill
                        direction={d > 0 ? "up" : d < 0 ? "down" : "flat"}
                        good={d === 0 ? undefined : d > 0}
                        text={`${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)} since`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={active ? "secondary" : "outline"}
                        size="xs"
                        aria-pressed={active}
                        onClick={() =>
                          setCompareId(active ? null : snapshot.id)
                        }
                      >
                        <GitCompareIcon /> {active ? "Comparing" : "Compare"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button type="button" variant="outline" size="xs" />
                          }
                        >
                          <RotateCcwIcon /> Restore
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Restore {snapshot.label}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              The current answers are replaced by the snapshot
                              from {formatDateTime(snapshot.takenAt)}. Take a
                              snapshot first if you want to keep them.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                readinessActions.restoreSnapshot(snapshot.id)
                                setCompareId(null)
                                toast("Snapshot restored", {
                                  description: snapshot.label,
                                })
                              }}
                            >
                              Restore
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Delete snapshot ${snapshot.label}`}
                              className="text-muted-foreground hover:text-danger-text"
                            />
                          }
                        >
                          <Trash2Icon />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete snapshot {snapshot.label}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              The snapshot from{" "}
                              {formatDateTime(snapshot.takenAt)} (score{" "}
                              {overall}) is removed from this browser. The
                              current assessment is not affected. You can undo
                              from the toast for a few seconds.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => {
                                readinessActions.deleteSnapshot(snapshot.id)
                                if (active) setCompareId(null)
                                toast("Snapshot deleted", {
                                  description: snapshot.label,
                                  duration: 8000,
                                  action: {
                                    label: "Undo",
                                    onClick: () =>
                                      readinessActions.addSnapshot(snapshot),
                                  },
                                })
                              }}
                            >
                              Delete snapshot
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {comparing && (
            <CompareView
              snapshot={comparing}
              assessment={assessment}
              result={result}
              controlSet={controlSet}
            />
          )}
        </>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Team mode                                                                 */
/* ------------------------------------------------------------------------ */

function TeamSection({
  assessment,
  respondent,
  controlSet,
}: {
  assessment: Assessment | null
  respondent: string
  controlSet: ControlSet
}) {
  const titleById = React.useMemo(
    () => new Map(controlSet.controls.map((c) => [c.id, c.title])),
    [controlSet]
  )
  const voteCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    if (!assessment) return counts
    for (const r of Object.values(assessment.responses))
      for (const name of Object.keys(r.votes ?? {}))
        counts.set(name, (counts.get(name) ?? 0) + 1)
    return counts
  }, [assessment])
  const contested = React.useMemo(() => {
    if (!assessment) return []
    return Object.entries(assessment.responses)
      .filter(([, r]) => voteSpread(r.votes) >= 2)
      .map(([id, r]) => ({
        id,
        votes: r.votes ?? {},
        current: r.status,
        consensus: consensusStatus(r.votes) ?? r.status,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [assessment])

  function applyAll() {
    for (const c of contested)
      readinessActions.respond(c.id, { status: c.consensus })
    toast("Consensus applied", {
      description: `${contested.length} control${contested.length === 1 ? "" : "s"} updated to the majority vote.`,
    })
  }

  return (
    <Section
      icon={<UsersIcon />}
      title="Team mode"
      description="Each reviewer enters a name and votes on a control's status from the Controls tab. Votes are stored per control; the majority becomes the consensus, with ties resolving to the lower status."
    >
      <Field className="max-w-sm">
        <FieldLabel htmlFor="respondent-name">Your name for votes</FieldLabel>
        <Input
          id="respondent-name"
          value={respondent}
          onChange={(e) => readinessActions.setRespondent(e.target.value)}
          placeholder="e.g. Amara Okafor"
          autoComplete="off"
        />
        <FieldDescription>
          Use your full name so votes match the respondents list. Stored
          locally; it labels your votes in the share link.
        </FieldDescription>
      </Field>
      {!assessment ? (
        <SetupRequired what="collect votes" />
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Respondents
            </p>
            {assessment.respondents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has voted yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {assessment.respondents.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1.5">
                    {name}
                    <span className="text-muted-foreground tabular-nums">
                      {voteCounts.get(name) ?? 0}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Needs discussion{" "}
                <span className="tabular-nums">({contested.length})</span>:
                votes spread two or more steps apart
              </p>
              {contested.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button type="button" size="xs" />}
                  >
                    <CheckCheckIcon /> Apply consensus to all
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Apply consensus to {contested.length} control
                        {contested.length === 1 ? "" : "s"}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Each contested control takes its majority vote (ties
                        resolve to the lower status), overwriting the current
                        status. Take a snapshot first if you want to compare.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={applyAll}>
                        Apply to {contested.length}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            {contested.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No disagreements: every voted control has adjacent answers.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableCaption className="sr-only">
                    Contested controls with votes, current and consensus status
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Control</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Consensus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contested.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-xs">
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            {c.id}
                          </span>
                          {titleById.get(c.id) ?? "Unknown control"}
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1.5">
                            {Object.entries(c.votes)
                              .sort(
                                ([, a], [, b]) =>
                                  statusOrder.indexOf(a) -
                                  statusOrder.indexOf(b)
                              )
                              .map(([name, status]) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center gap-1 text-xs"
                                >
                                  <span className="text-muted-foreground">
                                    {name}
                                  </span>
                                  <ControlStatusBadge
                                    status={status}
                                    size="sm"
                                  />
                                </span>
                              ))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ControlStatusBadge status={c.current} size="sm" />
                        </TableCell>
                        <TableCell>
                          <ControlStatusBadge status={c.consensus} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Privacy                                                                   */
/* ------------------------------------------------------------------------ */

function PrivacySection() {
  return (
    <Section icon={<LockIcon />} title="Privacy & data">
      <Alert>
        <ShieldCheckIcon />
        <AlertTitle>Everything stays in this browser</AlertTitle>
        <AlertDescription>
          <p>
            Answers, snapshots and your respondent name are saved in
            localStorage under the key{" "}
            <code className="font-mono text-xs">agentops.readiness.v1</code>.
            Nothing is sent to a server and there is no account.
          </p>
          <p>
            Share links embed the full assessment in the URL fragment, so treat
            a link as the data itself: anyone holding it can read every answer,
            owner and note.
          </p>
        </AlertDescription>
      </Alert>
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button type="button" variant="destructive" size="sm" />}
        >
          <Trash2Icon /> Clear all local data
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all readiness data?</AlertDialogTitle>
            <AlertDialogDescription>
              The assessment, every snapshot, your respondent name and any
              imported control set are removed from this browser. Export or copy
              a share link first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                readinessActions.reset()
                toast("Local data cleared", {
                  description:
                    "Assessment, snapshots, respondent name and imported control set removed from this browser.",
                })
              }}
            >
              Clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Customization                                                             */
/* ------------------------------------------------------------------------ */

function CustomizationSection({
  controlSet,
  customControlSet,
}: {
  controlSet: ControlSet
  customControlSet: ControlSet | null
}) {
  const [error, setError] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const set = parseControlSet(JSON.parse(await readFileText(file)))
      readinessActions.setControlSet(set)
      setError(null)
      toast("Control set imported", {
        description: `${set.name} v${set.version} · ${set.controls.length} controls`,
      })
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "The file is not valid JSON."
          : err instanceof Error
            ? err.message
            : "The control set could not be imported."
      )
    } finally {
      e.target.value = ""
    }
  }

  return (
    <Section
      icon={<Settings2Icon />}
      title="Customization"
      description={
        <>
          The control catalog lives in{" "}
          <code className="font-mono text-xs">lib/readiness/controls.ts</code>{" "}
          and is plain data: fork it to add your own controls, domains and
          framework tags, or import a JSON copy here to try one without a
          deploy.
        </>
      }
    >
      <DetailList
        dense
        columns={3}
        items={[
          {
            label: "Active control set",
            value: (
              <span className="flex items-center gap-2">
                {controlSet.name}
                {customControlSet && (
                  <Badge variant="secondary">Imported</Badge>
                )}
              </span>
            ),
          },
          { label: "Version", value: controlSet.version, mono: true },
          {
            label: "Controls",
            value: `${controlSet.controls.length} across ${controlSet.domains.length} domains`,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon /> Import control set JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Import control set file"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            downloadText(
              `${slug(controlSet.id)}-v${controlSet.version}.json`,
              JSON.stringify(controlSet, null, 2),
              "application/json"
            )
          }
        >
          <DownloadIcon /> Download current control set as JSON
        </Button>
        {customControlSet && (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="ghost" size="sm" />}
            >
              <RotateCcwIcon /> Revert to default
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Revert to the default control set?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {customControlSet.name} v{customControlSet.version} is removed
                  from this browser and every tab re-evaluates against{" "}
                  {defaultControlSet.name} v{defaultControlSet.version}.
                  Responses to control ids that only exist in the imported set
                  stop counting. Download the imported set first if you want to
                  keep it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    readinessActions.setControlSet(null)
                    toast("Reverted to the default control set", {
                      description: `${defaultControlSet.name} v${defaultControlSet.version}`,
                    })
                  }}
                >
                  Revert
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
      <p className="text-xs text-muted-foreground">
        A valid file has <code className="font-mono">id</code>,{" "}
        <code className="font-mono">name</code>,{" "}
        <code className="font-mono">version</code>, a{" "}
        <code className="font-mono">domains</code> array and a{" "}
        <code className="font-mono">controls</code> array where each control
        carries <code className="font-mono">id</code>,{" "}
        <code className="font-mono">domain</code>,{" "}
        <code className="font-mono">title</code>,{" "}
        <code className="font-mono">risk</code>,{" "}
        <code className="font-mono">requiredAt</code>,{" "}
        <code className="font-mono">frameworks</code> and{" "}
        <code className="font-mono">tools</code>.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Static deploy                                                             */
/* ------------------------------------------------------------------------ */

function DeploySection() {
  return (
    <Section icon={<GlobeIcon />} title="Static deploy">
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          This module is fully client-rendered: scoring, storage, exports and
          share links all run in the browser, so it needs no API routes or
          database.
        </li>
        <li>It works on Vercel and Netlify as-is with the rest of the app.</li>
        <li>
          For GitHub Pages or any plain static host, build the Next app with{" "}
          <code className="font-mono text-xs">output: &quot;export&quot;</code>{" "}
          in <code className="font-mono text-xs">next.config.ts</code> and serve
          the <code className="font-mono text-xs">out/</code> folder. See
          &quot;Static Exports&quot; in the Next.js docs (
          <span className="font-mono text-xs">
            nextjs.org/docs/app/guides/static-exports
          </span>
          ).
        </li>
      </ul>
    </Section>
  )
}

/* ------------------------------------------------------------------------ */
/* Tab                                                                       */
/* ------------------------------------------------------------------------ */

export function ShareTab({
  onBeforePrint,
}: {
  /** Called before `window.print()` so the parent can switch to Results. */
  onBeforePrint?: () => void
}) {
  const {
    assessment,
    result,
    snapshots,
    respondent,
    customControlSet,
    controlSet,
  } = useReadiness()

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ExportSection
        assessment={assessment}
        result={result}
        controlSet={controlSet}
        onBeforePrint={onBeforePrint}
      />
      <ShareLinkSection assessment={assessment} />
      <ImportSection
        controlSet={controlSet}
        hasAssessment={assessment !== null}
      />
      <HistorySection
        assessment={assessment}
        result={result}
        snapshots={snapshots}
        controlSet={controlSet}
      />
      <TeamSection
        assessment={assessment}
        respondent={respondent}
        controlSet={controlSet}
      />
      <PrivacySection />
      <CustomizationSection
        controlSet={controlSet}
        customControlSet={customControlSet}
      />
      <DeploySection />
    </div>
  )
}
