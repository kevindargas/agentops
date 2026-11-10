"use client"

import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function RegisterAgentButton() {
  return (
    <Button
      onClick={() =>
        toast("Registration wizard opened", {
          description:
            "Point it at a LangGraph or LangChain deployment and it starts tracing on the next run.",
        })
      }
    >
      <PlusIcon /> Register agent
    </Button>
  )
}
