"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { cn } from "cn"

import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import {
  estimateTokens,
  extractVariables,
  promptTypeLabel,
  type PromptType,
} from "@/lib/data/prompts"
import { createPrompt } from "./prompt-store"
import { VariableChip } from "./shared"

const agentItems = deployedAgents.map((a) => ({ value: a.id, label: a.name }))
const typeItems = (Object.keys(promptTypeLabel) as PromptType[]).map((t) => ({
  value: t,
  label: promptTypeLabel[t],
}))

const placeholder = `You are {{agent_name}} for the {{company}} service desk.

## Inputs
- Conversation: {{transcript}}

## Rules
- Ground every claim in {{knowledge_base}}.`

export function NewPromptButton({ size }: { size?: "sm" | "default" }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [agentId, setAgentId] = React.useState(deployedAgents[0]?.id ?? "")
  const [type, setType] = React.useState<PromptType>("system")
  const [template, setTemplate] = React.useState("")

  const variables = extractVariables(template)
  const canSave = name.trim().length > 1 && template.trim().length > 0

  const reset = () => {
    setName("")
    setType("system")
    setTemplate("")
  }

  const save = () => {
    const agent = getDeployedAgent(agentId) ?? deployedAgents[0]
    const prompt = createPrompt({
      name: name.trim(),
      agentId: agent.id,
      type,
      template,
      modelId: agent.modelId,
      params: agent.params,
      description: `${promptTypeLabel[type]} for ${agent.name}.`,
    })
    toast.success(
      `${prompt.name} created as draft v${prompt.versions[0].number}`,
      {
        description: `${promptTypeLabel[type]} for ${agent.name} · ${variables.length} ${variables.length === 1 ? "variable" : "variables"} · ~${estimateTokens(template)} tokens. It is at the top of the list for this session.`,
        action: {
          label: "Open",
          onClick: () => router.push(`/agentops/prompts/${prompt.id}`),
        },
      }
    )
    reset()
    setOpen(false)
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <PlusIcon /> New prompt
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>New prompt</SheetTitle>
            <SheetDescription>
              Registers a prompt with a first draft version. Variables are
              detected from <code className="font-mono">{"{{name}}"}</code>{" "}
              placeholders.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="prompt-name">Name</FieldLabel>
                <Input
                  id="prompt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Support triage system prompt"
                  autoComplete="off"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="prompt-agent">Agent</FieldLabel>
                  <Select
                    value={agentId}
                    onValueChange={(v) => v && setAgentId(v)}
                    items={agentItems}
                  >
                    <SelectTrigger id="prompt-agent" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agentItems.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="prompt-type">Type</FieldLabel>
                  <Select
                    value={type}
                    onValueChange={(v) => v && setType(v as PromptType)}
                    items={typeItems}
                  >
                    <SelectTrigger id="prompt-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="prompt-template">Template</FieldLabel>
                <Textarea
                  id="prompt-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={placeholder}
                  rows={12}
                  className="font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                <FieldDescription className="flex flex-wrap items-center gap-1.5">
                  {variables.length === 0 ? (
                    <>
                      Use <code className="font-mono">{"{{variable}}"}</code>{" "}
                      for runtime inputs; they appear here as you type.
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">
                        {variables.length}{" "}
                        {variables.length === 1 ? "variable" : "variables"} · ~
                        {estimateTokens(template)} tokens
                      </span>
                      {variables.map((v) => (
                        <VariableChip key={v} name={v} />
                      ))}
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button disabled={!canSave} onClick={save}>
                Create draft
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
