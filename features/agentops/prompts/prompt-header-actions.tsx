"use client"

import Link from "next/link"
import { BotIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { Prompt } from "@/lib/data/prompts"

export function PromptHeaderActions({ prompt }: { prompt: Prompt }) {
  const next = Math.max(...prompt.versions.map((v) => v.number)) + 1
  return (
    <>
      <Button
        variant="outline"
        render={<Link href={`/agentops/agents/${prompt.agentId}`} />}
      >
        <BotIcon /> Agent
      </Button>
      <Button
        onClick={() =>
          toast("New version drafted", {
            description: `p-${next} created from the current production template. Edit, run evals, then promote.`,
          })
        }
      >
        <PlusIcon /> New version
      </Button>
    </>
  )
}
