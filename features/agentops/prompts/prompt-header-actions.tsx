"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { BotIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { setQueryParams } from "@/hooks/use-query-param"
import { Button } from "@/components/ui/button"
import {
  latestVersion,
  productionVersion,
  type Prompt,
} from "@/lib/data/prompts"
import { createVersion } from "./prompt-store"

export function PromptHeaderActions({ prompt }: { prompt: Prompt }) {
  const router = useRouter()

  const newVersion = () => {
    const base = productionVersion(prompt) ?? latestVersion(prompt)
    const version = createVersion({
      promptId: prompt.id,
      template: base.template,
      modelId: base.modelId,
      params: base.params,
      changeNote: `Draft from v${base.number}. Edit, run evals, then promote.`,
    })
    if (!version) return
    setQueryParams({ tab: "editor", version: version.id })
    toast.success(`v${version.number} drafted`, {
      description: `${version.id} copies v${base.number}'s template and parameters. It is listed on the Versions tab as a draft.`,
      action: {
        label: "Tune in Playground",
        onClick: () =>
          router.push(
            `/agentops/playground?agent=${prompt.agentId}&pv=${version.id}`
          ),
      },
    })
  }

  return (
    <>
      <Button
        variant="outline"
        render={<Link href={`/agentops/agents/${prompt.agentId}`} />}
      >
        <BotIcon /> Agent
      </Button>
      <Button onClick={newVersion}>
        <PlusIcon /> New version
      </Button>
    </>
  )
}
