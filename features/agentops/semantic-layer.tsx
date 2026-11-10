"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { CopyButton } from "@/components/shared/copy-button"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { semanticEntities as seed } from "@/lib/data"
import { formatNumber } from "@/lib/format"
import type { SemanticEntity, SemanticKind } from "@/lib/types"
import { AgentChip } from "./shared"

const col = createColumnHelper<DataTableFeatures, SemanticEntity>()
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
        "h-5 px-1.5 text-[11px] font-medium capitalize",
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
      <DataTableColumnHeader column={column} title="Agents" />
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
    options: ["metric", "dimension", "entity", "glossary"].map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
    })),
    getValue: (r) => r.kind,
  },
  {
    id: "domain",
    title: "Domain",
    options: [...new Set(seed.map((s) => s.domain))]
      .sort()
      .map((v) => ({ value: v, label: v })),
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

export function SemanticLayer() {
  const router = useRouter()
  const params = useSearchParams()
  const [items, setItems] = React.useState<SemanticEntity[]>(seed)
  const openId = params.get("entity")
  const open = items.find((s) => s.id === openId) ?? null

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set("entity", id)
    else next.delete("entity")
    router.replace(`/agentops/semantic-layer${next.size ? `?${next}` : ""}`, {
      scroll: false,
    })
  }
  const patch = (id: string, p: Partial<SemanticEntity>) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))

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
        selectionLabel={(n) => (n === 1 ? "definition" : "definitions")}
        toolbar={
          <Button
            size="sm"
            onClick={() => toast("New definition editor opened")}
          >
            <PlusIcon /> New definition
          </Button>
        }
      />
      <EntitySheet
        entity={open}
        onClose={() => setOpen(null)}
        onPatch={patch}
      />
    </>
  )
}

function EntitySheet({
  entity: s,
  onClose,
  onPatch,
}: {
  entity: SemanticEntity | null
  onClose: () => void
  onPatch: (id: string, p: Partial<SemanticEntity>) => void
}) {
  const [synonym, setSynonym] = React.useState("")
  return (
    <Sheet open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {s && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <KindBadge kind={s.kind} />
                <StateBadge state={s.status} />
                <Badge variant="outline" className="text-muted-foreground">
                  {s.domain}
                </Badge>
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                              onPatch(s.id, {
                                issues: s.issues.filter((x) => x !== issue),
                              })
                              toast.success("Issue resolved")
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
                        Glossary term, no physical source.
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {s.sources.map((src) => (
                          <li key={src}>
                            <code className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px]">
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
                            onPatch(s.id, {
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
                      onPatch(s.id, { synonyms: [...s.synonyms, v] })
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
                  <Fact label="Owner">
                    <UserChip userId={s.ownerId} size="xs" />
                  </Fact>
                  <Fact label="Queries · 30d">
                    {formatNumber(s.queries30d)}
                  </Fact>
                  <Fact label="Last verified">
                    {s.lastVerified ? (
                      <DateCell value={s.lastVerified} tone="default" />
                    ) : (
                      "Never"
                    )}
                  </Fact>
                </section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              {s.status !== "Deprecated" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onPatch(s.id, { status: "Deprecated" })
                    toast("Definition deprecated", {
                      description:
                        "Agents will stop resolving to it after the next sync",
                    })
                  }}
                >
                  Deprecate
                </Button>
              )}
              {s.status === "Verified" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onPatch(s.id, { status: "Needs review" })
                    toast("Review requested from the owner")
                  }}
                >
                  <BookMarkedIcon /> Request review
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    onPatch(s.id, {
                      status: "Verified",
                      lastVerified: new Date().toISOString(),
                      issues: s.issues.filter(
                        (i) => !i.startsWith("Last verified")
                      ),
                    })
                    toast.success(`${s.name} verified`)
                  }}
                >
                  <ShieldCheckIcon /> Mark verified
                </Button>
              )}
              {s.status === "Deprecated" && (
                <Button
                  size="sm"
                  onClick={() => {
                    onPatch(s.id, { status: "Draft" })
                    toast("Restored as draft")
                  }}
                >
                  <CheckIcon /> Restore
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
