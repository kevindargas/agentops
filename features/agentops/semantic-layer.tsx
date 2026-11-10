"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BookMarkedIcon,
  CheckIcon,
  PlusIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { setQueryParam } from "@/hooks/use-query-param"
import { CopyButton } from "@/components/shared/copy-button"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { semanticEntities as seed } from "@/lib/data/agentops"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatNumber } from "@/lib/format"
import type { SemanticDomain, SemanticEntity, SemanticKind } from "@/lib/types"
import { AgentChip } from "./shared"
import { semanticStore } from "./stores"

const col = createColumnHelper<DataTableFeatures, SemanticEntity>()
const kinds: SemanticKind[] = ["metric", "dimension", "entity", "glossary"]
const domains = [...new Set(seed.map((s) => s.domain))].sort()
const kindTone: Record<SemanticKind, string> = {
  metric: "border-brand/30 bg-brand/10 text-brand",
  dimension: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  entity: "border-chart-3/30 bg-chart-3/15 text-chart-3",
  glossary: "border-border bg-muted text-muted-foreground",
}

export function KindBadge({ kind }: { kind: SemanticKind }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-2xs font-medium capitalize",
        kindTone[kind]
      )}
    >
      {kind}
    </Badge>
  )
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Definition" />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <KindBadge kind={row.original.kind} />
        <TwoLineCell
          primary={row.original.name}
          secondary={row.original.definition}
          className="min-w-0"
        />
      </span>
    ),
    enableHiding: false,
    meta: {
      width: "min-w-80 max-w-2xl",
      label: "Definition",
      skeleton: "w-64",
    },
  }),
  col.accessor("domain", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Domain" />
    ),
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue()}</span>
    ),
    meta: { width: "w-28", label: "Domain", skeleton: "w-16" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue, row }) => (
      <span className="flex items-center gap-1.5">
        <StateBadge state={getValue()} />
        {row.original.issues.length > 0 && (
          <TriangleAlertIcon
            className="size-3.5 text-warning"
            aria-label={`${row.original.issues.length} issues`}
          />
        )}
      </span>
    ),
    meta: { width: "w-36", label: "Status", skeleton: "w-20 rounded-full" },
  }),
  col.accessor((r) => r.usedByAgentIds.length, {
    id: "agents",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Agents"
        hint="Agents allowed to resolve user phrases to this definition."
      />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} muted={getValue() === 0} />
    ),
    meta: {
      width: "w-20",
      label: "Used by agents",
      numeric: true,
      skeleton: "w-6",
    },
  }),
  col.accessor("queries30d", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Queries · 30d" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatNumber(n)} />
    ),
    meta: { width: "w-28", label: "Queries", numeric: true, skeleton: "w-10" },
  }),
  col.accessor((r) => r.synonyms.length, {
    id: "synonyms",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Synonyms" />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} muted />,
    meta: { width: "w-24", label: "Synonyms", numeric: true, skeleton: "w-6" },
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
  col.accessor("lastVerified", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Verified" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    sortUndefined: "last",
    meta: { width: "w-28", label: "Last verified", skeleton: "w-16" },
  }),
])

const facets: FacetDef<SemanticEntity>[] = [
  {
    id: "kind",
    title: "Kind",
    options: kinds.map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
    })),
    getValue: (r) => r.kind,
  },
  {
    id: "domain",
    title: "Domain",
    options: domains.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.domain,
  },
  {
    id: "status",
    title: "Status",
    options: ["Verified", "Needs review", "Draft", "Deprecated"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.status,
  },
  {
    id: "issues",
    title: "Issues",
    options: [
      { value: "yes", label: "Has issues" },
      { value: "no", label: "Clean" },
    ],
    getValue: (r) => (r.issues.length ? "yes" : "no"),
  },
]

/** Stat row for the Semantic Layer page, read from the same store as the table. */
export function SemanticStats() {
  const items = semanticStore.use()
  const verified = items.filter((s) => s.status === "Verified").length
  const issues = items.reduce((n, s) => n + s.issues.length, 0)
  const draftInUse = items.filter(
    (s) => s.status !== "Verified" && s.usedByAgentIds.length > 0
  ).length
  return (
    <StatGrid columns={4}>
      <StatCard
        label="Definitions"
        value={items.length}
        hint={`${verified} verified`}
      />
      <StatCard
        label="Lint issues"
        value={issues}
        upIsGood={false}
        hint="Stale, ambiguous or unowned"
      />
      <StatCard
        label="Unverified in use"
        value={draftInUse}
        upIsGood={false}
        hint="Referenced by agents"
      />
      <StatCard
        label="Queries · 30d"
        value={formatNumber(
          items.reduce((n, s) => n + s.queries30d, 0),
          true
        )}
        hint="Resolutions through the semantic-layer server"
      />
    </StatGrid>
  )
}

export function SemanticLayer() {
  const params = useSearchParams()
  const items = semanticStore.use()
  const [creating, setCreating] = React.useState(false)
  const openId = params.get("entity")
  const open = items.find((s) => s.id === openId) ?? null

  const setOpen = (id: string | null) => setQueryParam("entity", id)

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.definition} ${r.synonyms.join(" ")} ${r.sources.join(" ")} ${r.domain}`
        }
        searchPlaceholder="Search definitions, synonyms, sources…"
        facets={facets}
        initialSorting={[{ id: "queries30d", desc: true }]}
        initialColumnVisibility={{ synonyms: false, ownerId: false }}
        onRowClick={(r) => setOpen(r.id)}
        totalLabel="definitions"
        caption="Semantic layer definitions"
        selectionLabel={(n) => (n === 1 ? "definition" : "definitions")}
        toolbar={
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> New definition
          </Button>
        }
      />
      <EntitySheet entity={open} onClose={() => setOpen(null)} />
      <NewDefinitionSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => setOpen(id)}
      />
    </>
  )
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

function NewDefinitionSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = React.useState("")
  const [kind, setKind] = React.useState<SemanticKind>("metric")
  const [domain, setDomain] = React.useState<SemanticDomain>(domains[0])
  const [definition, setDefinition] = React.useState("")
  const [formula, setFormula] = React.useState("")
  const valid = name.trim().length > 1 && definition.trim().length > 10

  const create = () => {
    const id = `sem-${slug(name)}`
    if (semanticStore.get().some((s) => s.id === id)) {
      toast.error("A definition with this name already exists")
      return
    }
    const entity: SemanticEntity = {
      id,
      name: name.trim(),
      kind,
      domain,
      definition: definition.trim(),
      formula: kind === "metric" && formula.trim() ? formula.trim() : undefined,
      sources: [],
      synonyms: [],
      ownerId: currentUser.id,
      status: "Draft",
      usedByAgentIds: [],
      queries30d: 0,
      issues: ["No owner sign-off"],
    }
    semanticStore.add(entity, "start")
    onOpenChange(false)
    setName("")
    setDefinition("")
    setFormula("")
    toast.success(`${entity.name} created as a draft`, {
      description: "Add sources and synonyms, then mark it verified.",
    })
    onCreated(id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>New definition</SheetTitle>
          <SheetDescription>
            Starts as a Draft owned by you. Agents cannot resolve to it until it
            is verified and added to their allowlist.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form
            id="new-definition"
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (valid) create()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sem-name">Name</Label>
              <Input
                id="sem-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First response time"
                required
              />
              <p className="text-xs text-muted-foreground">
                Id becomes{" "}
                <span className="font-mono">sem-{slug(name) || "name"}</span>
              </p>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Kind</legend>
              <RadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as SemanticKind)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                aria-label="Kind"
              >
                {kinds.map((k) => (
                  <Label
                    key={k}
                    htmlFor={`kind-${k}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm capitalize has-data-checked:border-ring has-data-checked:bg-muted/40"
                  >
                    <RadioGroupItem id={`kind-${k}`} value={k} />
                    {k}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Domain</legend>
              <RadioGroup
                value={domain}
                onValueChange={(v) => setDomain(v as SemanticDomain)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                aria-label="Domain"
              >
                {domains.map((d) => (
                  <Label
                    key={d}
                    htmlFor={`domain-${d}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm has-data-checked:border-ring has-data-checked:bg-muted/40"
                  >
                    <RadioGroupItem id={`domain-${d}`} value={d} />
                    {d}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sem-definition">Definition</Label>
              <Textarea
                id="sem-definition"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Plain-language meaning, including period and currency rules where relevant"
                className="min-h-24 text-sm"
                required
              />
            </div>
            {kind === "metric" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sem-formula">Formula (optional)</Label>
                <Textarea
                  id="sem-formula"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="SELECT ..."
                  className="min-h-16 font-mono text-xs"
                />
              </div>
            )}
          </form>
        </SheetBody>
        <SheetFooterActions
          primary={
            <Button type="submit" form="new-definition" disabled={!valid}>
              <PlusIcon /> Create draft
            </Button>
          }
        />
      </SheetContent>
    </Sheet>
  )
}

function EntitySheet({
  entity: s,
  onClose,
}: {
  entity: SemanticEntity | null
  onClose: () => void
}) {
  const [synonym, setSynonym] = React.useState("")
  const patch = (id: string, p: Partial<SemanticEntity>) =>
    semanticStore.patch(id, p)
  const undoable = (
    entity: SemanticEntity,
    p: Partial<SemanticEntity>,
    title: string,
    description: string
  ) => {
    patch(entity.id, p)
    toast(title, {
      description,
      action: {
        label: "Undo",
        onClick: () =>
          semanticStore.set((prev) =>
            prev.map((x) => (x.id === entity.id ? entity : x))
          ),
      },
      duration: 6000,
    })
  }

  return (
    <Sheet open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {s && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <KindBadge kind={s.kind} />
                <StateBadge state={s.status} />
                <Badge variant="outline" className="text-muted-foreground">
                  {s.domain}
                </Badge>
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
                  {s.id} <CopyButton value={s.id} label="Copy id" />
                </span>
              </div>
              <SheetTitle className="text-lg leading-tight">
                {s.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed text-foreground/80">
                {s.definition}
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                {s.issues.length > 0 && (
                  <section className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-warning-text">
                      <TriangleAlertIcon className="size-4" /> {s.issues.length}{" "}
                      lint issue{s.issues.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {s.issues.map((issue) => (
                        <li
                          key={issue}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span>{issue}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              patch(s.id, {
                                issues: s.issues.filter((x) => x !== issue),
                              })
                              toast.success("Issue resolved", {
                                description: issue,
                              })
                            }}
                          >
                            Resolve
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {s.formula && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Formula</h3>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed">
                      {s.formula}
                    </pre>
                  </section>
                )}

                <section className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Sources</h3>
                    {s.sources.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {s.kind === "glossary"
                          ? "Glossary term, no physical source."
                          : "No source recorded yet."}
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {s.sources.map((src) => (
                          <li key={src}>
                            <code className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-2xs">
                              {src}
                            </code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Used by</h3>
                    {s.usedByAgentIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No agent references this definition.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {s.usedByAgentIds.map((id) => (
                          <li key={id}>
                            <AgentChip agentId={id} size="sm" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Synonyms</h3>
                  <p className="text-xs text-muted-foreground">
                    Phrases agents resolve to this definition. Keep them
                    unambiguous across domains.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.synonyms.map((syn) => (
                      <Badge
                        key={syn}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {syn}
                        <button
                          type="button"
                          aria-label={`Remove synonym ${syn}`}
                          className="rounded-sm p-0.5 hover:bg-background/60"
                          onClick={() =>
                            patch(s.id, {
                              synonyms: s.synonyms.filter((x) => x !== syn),
                            })
                          }
                        >
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const v = synonym.trim()
                      if (!v || s.synonyms.includes(v)) return
                      patch(s.id, { synonyms: [...s.synonyms, v] })
                      setSynonym("")
                    }}
                  >
                    <Input
                      value={synonym}
                      onChange={(e) => setSynonym(e.target.value)}
                      placeholder="Add a synonym…"
                      className="h-8 text-sm"
                      aria-label="New synonym"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={!synonym.trim()}
                    >
                      <PlusIcon /> Add
                    </Button>
                  </form>
                </section>

                <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <MetricTile
                    label="Owner"
                    value={<UserChip userId={s.ownerId} size="xs" />}
                  />
                  <MetricTile
                    label="Queries · 30d"
                    value={formatNumber(s.queries30d)}
                  />
                  <MetricTile
                    label="Last verified"
                    value={
                      s.lastVerified ? (
                        <DateCell value={s.lastVerified} tone="default" />
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )
                    }
                  />
                </section>
              </div>
            </SheetBody>

            <SheetFooterActions
              tertiary={
                s.status !== "Deprecated" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      undoable(
                        s,
                        { status: "Deprecated" },
                        "Definition deprecated",
                        "Agents keep resolving to it until their next sync; Restore from this sheet if needed."
                      )
                    }
                  >
                    Deprecate
                  </Button>
                ) : undefined
              }
              secondary={
                s.status === "Verified" ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      undoable(
                        s,
                        { status: "Needs review" },
                        "Marked for review",
                        `${s.name} shows as Needs review until the owner verifies it again.`
                      )
                    }
                  >
                    <BookMarkedIcon /> Request review
                  </Button>
                ) : s.status === "Deprecated" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      patch(s.id, { status: "Draft" })
                      toast("Restored as draft")
                    }}
                  >
                    <CheckIcon /> Restore
                  </Button>
                ) : undefined
              }
              primary={
                s.status !== "Verified" ? (
                  <Button
                    onClick={() => {
                      patch(s.id, {
                        status: "Verified",
                        lastVerified: clock().toISOString(),
                        issues: s.issues.filter(
                          (i) => !i.startsWith("Last verified")
                        ),
                      })
                      toast.success(`${s.name} verified`, {
                        description: "Verification date set to today.",
                      })
                    }}
                  >
                    <ShieldCheckIcon /> Mark verified
                  </Button>
                ) : undefined
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
