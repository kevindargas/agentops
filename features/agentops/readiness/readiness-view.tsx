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

import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { readShareHash } from "@/lib/readiness/codec"
import { readinessActions } from "@/lib/readiness/store"
import { ControlSheet } from "./control-sheet"
import { ControlsTab } from "./controls-tab"
import { FrameworksTab } from "./frameworks-tab"
import { LibraryTab } from "./library-tab"
import { ResultsTab } from "./results-tab"
import { SetupForm } from "./setup-form"
import { ShareTab } from "./share-tab"
import { ToolingTab } from "./tooling-tab"
import {
  readinessTabs,
  setQueryParam,
  useReadiness,
  type ReadinessTab,
} from "./shared"

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

export function ReadinessView({
  initialTab,
  initialControlId,
}: {
  initialTab?: string
  initialControlId?: string
}) {
  const { assessment, controlSet } = useReadiness()
  const [tab, setTab] = React.useState<ReadinessTab>(
    readinessTabs.includes(initialTab as ReadinessTab)
      ? (initialTab as ReadinessTab)
      : "results"
  )
  const [openId, setOpenId] = React.useState<string | null>(
    initialControlId &&
      controlSet.controls.some((c) => c.id === initialControlId)
      ? initialControlId
      : null
  )

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

  // Shared links carry the whole assessment in the URL fragment.
  React.useEffect(() => {
    const shared = readShareHash(window.location.hash)
    if (!shared) return
    readinessActions.load(shared)
    const url = new URL(window.location.href)
    url.hash = ""
    window.history.replaceState(null, "", url)
    toast("Assessment loaded from link", {
      description: `${shared.name} · ${Object.keys(shared.responses).length} answered controls`,
    })
  }, [])

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

      <ControlSheet controlId={openId} onClose={closeControl} />
    </>
  )
}

function NeedsSetup({ onSetup }: { onSetup: () => void }) {
  return (
    <EmptyState
      title="Describe your system first"
      description="The applicability filter and maturity target come from the system profile. It takes a minute."
      action={
        <button
          type="button"
          onClick={onSetup}
          className="text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Go to Setup
        </button>
      }
    />
  )
}
