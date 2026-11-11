"use client"

import * as React from "react"
import {
  BookOpenIcon,
  ChartPieIcon,
  ListChecksIcon,
  NetworkIcon,
  Share2Icon,
  SlidersHorizontalIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { setQueryParam } from "@/hooks/use-query-param"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/skeletons"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime } from "@/lib/format"
import { readShareHash } from "@/lib/readiness/codec"
import { maturityTargetLabel, systemTypeLabel } from "@/lib/readiness/labels"
import {
  BEFORE_IMPORT_LABEL,
  readinessActions,
  readinessStore,
  useReadinessHydrated,
} from "@/lib/readiness/store"
import type { Assessment } from "@/lib/readiness/types"
import { ControlSheet } from "./control-sheet"
import { ControlsTab } from "./controls-tab"
import { FrameworksTab } from "./frameworks-tab"
import { LibraryTab } from "./library-tab"
import { ResultsTab } from "./results-tab"
import { SetupForm } from "./setup-form"
import { ShareTab } from "./share-tab"
import { ToolingTab } from "./tooling-tab"
import { readinessTabs, useReadiness, type ReadinessTab } from "./shared"

const tabMeta: Record<
  ReadinessTab,
  { label: string; icon: React.ReactNode; needsAssessment: boolean }
> = {
  setup: {
    label: "Setup",
    icon: <SlidersHorizontalIcon />,
    needsAssessment: false,
  },
  controls: {
    label: "Controls",
    icon: <ListChecksIcon />,
    needsAssessment: true,
  },
  results: { label: "Results", icon: <ChartPieIcon />, needsAssessment: true },
  frameworks: {
    label: "Frameworks",
    icon: <NetworkIcon />,
    needsAssessment: true,
  },
  tooling: { label: "Tooling", icon: <WrenchIcon />, needsAssessment: false },
  library: { label: "Library", icon: <BookOpenIcon />, needsAssessment: false },
  share: { label: "Share", icon: <Share2Icon />, needsAssessment: false },
}

function stripShareHash() {
  const url = new URL(window.location.href)
  url.hash = ""
  window.history.replaceState(null, "", url)
}

function tabFromParam(v: string | undefined): ReadinessTab {
  return readinessTabs.includes(v as ReadinessTab)
    ? (v as ReadinessTab)
    : "results"
}

/**
 * Page body for /agentops/readiness. `ReadinessRoute` passes the current
 * `?tab=` and `?control=`; the view keeps them in local state (it also moves
 * tabs on its own when an assessment appears) and adopts a new URL value
 * during render, so a link into this route updates the page in place while
 * the view's own `setQueryParam` writes round-trip without a remount.
 */
export function ReadinessView({
  initialTab,
  initialControlId,
}: {
  /** `?tab=`; anything unknown falls back to `results`. */
  initialTab?: string
  /** `?control=`; unknown ids are ignored. */
  initialControlId?: string
}) {
  const hydrated = useReadinessHydrated()
  const { assessment, controlSet, result, showNotApplicable } = useReadiness()
  const resolveControl = (id: string | undefined) =>
    id && controlSet.controls.some((c) => c.id === id) ? id : null

  const [tab, setTab] = React.useState<ReadinessTab>(() =>
    tabFromParam(initialTab)
  )
  const [openId, setOpenId] = React.useState<string | null>(() =>
    resolveControl(initialControlId)
  )
  // Adopt URL changes made outside this view (links into the route, the
  // sidebar). Own writes arrive here with the value already in state.
  const [seenTab, setSeenTab] = React.useState(initialTab)
  if (initialTab !== seenTab) {
    setSeenTab(initialTab)
    setTab(tabFromParam(initialTab))
  }
  const [seenControlId, setSeenControlId] = React.useState(initialControlId)
  if (initialControlId !== seenControlId) {
    setSeenControlId(initialControlId)
    setOpenId(resolveControl(initialControlId))
  }

  // When an assessment appears (created, loaded or imported) while the user
  // sits on Setup, move them to the controls list. Derived during render so
  // no effect is needed.
  const [seenAssessmentId, setSeenAssessmentId] = React.useState<string | null>(
    null
  )
  if (assessment && assessment.id !== seenAssessmentId) {
    setSeenAssessmentId(assessment.id)
    if (seenAssessmentId !== null || tab === "setup") setTab("controls")
  }

  // Shared links carry the whole assessment in the URL fragment. The hash is
  // only read after hydration; with no current assessment it loads straight
  // away, otherwise the user confirms and the current one is snapshotted.
  const shared = React.useMemo(
    () => (hydrated ? readShareHash(window.location.hash) : null),
    [hydrated]
  )
  const [sharedDecided, setSharedDecided] = React.useState(false)
  const autoLoaded = React.useRef(false)
  React.useEffect(() => {
    if (!shared || sharedDecided || autoLoaded.current) return
    const current = readinessStore.get().assessment
    // A different assessment is open: the dialog below asks first.
    if (current && current.id !== shared.id) return
    autoLoaded.current = true
    readinessActions.load(shared)
    stripShareHash()
    toast(
      current ? "Assessment updated from link" : "Assessment loaded from link",
      {
        description: `${shared.name} · ${Object.keys(shared.responses).length} answered controls`,
      }
    )
  }, [shared, sharedDecided])
  const pendingShared =
    shared && !sharedDecided && assessment && assessment.id !== shared.id
      ? shared
      : null

  const effectiveTab: ReadinessTab =
    !assessment && tabMeta[tab].needsAssessment ? "setup" : tab

  const changeTab = (next: ReadinessTab) => {
    setTab(next)
    setQueryParam("tab", next === "results" ? null : next)
  }
  const openControl = React.useCallback((id: string) => {
    setOpenId(id)
    setQueryParam("control", id)
  }, [])
  const closeControl = () => {
    setOpenId(null)
    setQueryParam("control", null)
  }

  // Order used by the sheet's previous / next buttons: the controls as the
  // Controls tab lists them, hiding not-applicable ones unless shown.
  const navigationIds = React.useMemo(
    () =>
      (result?.controls ?? [])
        .filter(
          (e) => showNotApplicable || e.applicability !== "not-applicable"
        )
        .map((e) => e.control.id),
    [result, showNotApplicable]
  )

  if (!hydrated) return <TableSkeleton />

  return (
    <>
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => changeTab(v as ReadinessTab)}
        className="gap-4"
      >
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto"
        >
          {readinessTabs.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              disabled={!assessment && tabMeta[t].needsAssessment}
              className="gap-1.5 [&_svg]:size-3.5"
            >
              {tabMeta[t].icon}
              {tabMeta[t].label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="setup">
          <SetupForm mode={assessment ? "edit" : "create"} />
        </TabsContent>
        <TabsContent value="controls">
          {assessment ? (
            <ControlsTab onOpen={openControl} />
          ) : (
            <NeedsSetup onSetup={() => changeTab("setup")} />
          )}
        </TabsContent>
        <TabsContent value="results">
          {assessment ? (
            <ResultsTab onOpen={openControl} />
          ) : (
            <NeedsSetup onSetup={() => changeTab("setup")} />
          )}
        </TabsContent>
        <TabsContent value="frameworks">
          {assessment ? (
            <FrameworksTab onOpen={openControl} />
          ) : (
            <NeedsSetup onSetup={() => changeTab("setup")} />
          )}
        </TabsContent>
        <TabsContent value="tooling">
          <ToolingTab onOpen={openControl} />
        </TabsContent>
        <TabsContent value="library">
          <LibraryTab onOpen={openControl} />
        </TabsContent>
        <TabsContent value="share">
          <ShareTab onBeforePrint={() => setTab("results")} />
        </TabsContent>
      </Tabs>

      <ControlSheet
        controlId={openId}
        onClose={closeControl}
        onNavigate={openControl}
        navigationIds={navigationIds}
        onSetup={() => {
          closeControl()
          changeTab("setup")
        }}
      />

      <SharedLinkDialog
        shared={pendingShared}
        current={assessment}
        onCancel={() => {
          setSharedDecided(true)
          stripShareHash()
        }}
        onReplace={() => {
          if (!pendingShared) return
          readinessActions.replace(pendingShared, BEFORE_IMPORT_LABEL)
          setSharedDecided(true)
          stripShareHash()
          toast("Assessment replaced from link", {
            description: `${pendingShared.name} loaded; the previous assessment was saved as the snapshot "${BEFORE_IMPORT_LABEL}".`,
          })
        }}
      />
    </>
  )
}

function SharedLinkDialog({
  shared,
  current,
  onCancel,
  onReplace,
}: {
  shared: Assessment | null
  current: Assessment | null
  onCancel: () => void
  onReplace: () => void
}) {
  return (
    <AlertDialog open={shared !== null} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Replace the current assessment?</AlertDialogTitle>
          <AlertDialogDescription>
            This link carries a full assessment. Loading it replaces{" "}
            <span className="font-medium text-foreground">
              {current?.name ?? "the current assessment"}
            </span>
            ; the current answers are saved first as the snapshot{" "}
            <span className="font-medium text-foreground">
              {BEFORE_IMPORT_LABEL}
            </span>{" "}
            so you can restore or compare them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {shared && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <DetailList
              dense
              columns={2}
              items={[
                { label: "Name", value: shared.name },
                { label: "System", value: shared.profile.name },
                {
                  label: "Type",
                  value: systemTypeLabel[shared.profile.systemType],
                },
                { label: "Target", value: maturityTargetLabel[shared.target] },
                {
                  label: "Responses",
                  value: Object.keys(shared.responses).length,
                },
                { label: "Updated", value: formatDateTime(shared.updatedAt) },
              ]}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current</AlertDialogCancel>
          <AlertDialogAction onClick={onReplace}>
            Snapshot and replace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function NeedsSetup({ onSetup }: { onSetup: () => void }) {
  return (
    <EmptyState
      title="Describe your system first"
      description="The applicability filter and maturity target come from the system profile. It takes a minute."
      action={
        <Button variant="outline" size="sm" onClick={onSetup}>
          Go to Setup
        </Button>
      }
    />
  )
}
