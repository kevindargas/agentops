"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  extractVariables,
  estimateTokens,
  promptTypeLabel,
  type PromptType,
} from "@/lib/data/prompts"
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

export function NewPromptButton() {
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
    const agent = getDeployedAgent(agentId)
    toast.success(`Prompt "${name.trim()}" created as draft v1`, {
      description: `${promptTypeLabel[type]} for ${agent?.name ?? "agent"} · ${variables.length} ${variables.length === 1 ? "variable" : "variables"} · ~${estimateTokens(template)} tokens`,
    })
    reset()
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New prompt
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>New prompt</SheetTitle>
            <SheetDescription>
              Registers a prompt with a first draft version. Variables are
              detected from <code className="font-mono">{"{{name}}"}</code>{" "}
              placeholders.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                      for runtime inputs — they appear here as you type.
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
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                reset()
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={save}>
              Create draft
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
