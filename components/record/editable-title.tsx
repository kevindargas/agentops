"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, PencilIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Record title with inline rename. The new title lives in local state and a
 * toast confirms the change; nothing is persisted (sample data). Pass
 * `onRename` to hook up a real mutation.
 */
export function EditableTitle({
  title,
  onRename,
  className,
}: {
  title: string
  onRename?: (next: string) => void
  className?: string
}) {
  const [value, setValue] = React.useState(title)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(title)

  function start() {
    setDraft(value)
    setEditing(true)
  }
  function cancel() {
    setEditing(false)
  }
  function save() {
    const next = draft.trim()
    setEditing(false)
    if (!next || next === value) return
    setValue(next)
    onRename?.(next)
    toast.success("Title updated", {
      description: "Saved for this session only; sample data is not persisted.",
    })
  }

  if (editing) {
    return (
      <form
        className={cn("flex w-full max-w-3xl items-center gap-2", className)}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              cancel()
            }
          }}
          aria-label="Record title"
          className="h-9 font-heading text-lg font-semibold tracking-tight md:text-xl"
        />
        <Button type="submit" size="icon-sm" aria-label="Save title">
          <CheckIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel"
          onClick={cancel}
        >
          <XIcon />
        </Button>
      </form>
    )
  }

  return (
    <div
      className={cn("group/title flex min-w-0 items-start gap-1", className)}
    >
      <h1 className="font-heading text-xl font-semibold tracking-tight text-balance md:text-2xl">
        {value}
      </h1>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Edit title"
        title="Edit title"
        onClick={start}
        className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100"
      >
        <PencilIcon />
      </Button>
    </div>
  )
}
