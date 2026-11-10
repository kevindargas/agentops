"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "cn"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

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
import { setQueryParam } from "@/hooks/use-query-param"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { knowledgeArticles } from "@/lib/data/catalog"
import { NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import type { KnowledgeArticle } from "@/lib/types"
import { knowledgeStore, nextArticleNumber } from "./knowledge-store"

type KnowledgeBase = KnowledgeArticle["knowledgeBase"]

const knowledgeBases = Array.from(
  new Set(knowledgeArticles.map((a) => a.knowledgeBase))
) as KnowledgeBase[]

const categoriesByBase = knowledgeArticles.reduce<Record<string, string[]>>(
  (acc, a) => {
    const list = (acc[a.knowledgeBase] ??= [])
    if (!list.includes(a.category)) list.push(a.category)
    return acc
  },
  {}
)

/**
 * Create sheet for knowledge articles. Opens from `?new=1` (quick create,
 * command menu and the list header) and appends a Draft to `knowledgeStore`,
 * so the table shows it immediately.
 */
export function NewArticleSheet() {
  const params = useSearchParams()
  const [openState, setOpenState] = React.useState<boolean | null>(null)
  const open = openState ?? params.get("new") === "1"
  const setOpen = (next: boolean) => setOpenState(next)
  const [base, setBase] = React.useState<KnowledgeBase>("IT")
  const [title, setTitle] = React.useState("")
  const [dirty, setDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const categories = categoriesByBase[base] ?? []

  function reset() {
    setBase("IT")
    setTitle("")
    setDirty(false)
  }

  function leave() {
    setOpen(false)
    reset()
    if (params.get("new")) setQueryParam("new", null)
  }

  function close(next: boolean) {
    if (!next && dirty) {
      setDiscardOpen(true)
      return
    }
    if (next) setOpen(true)
    else leave()
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const number = nextArticleNumber()
    const tags = String(data.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const article: KnowledgeArticle = {
      number,
      title: title.trim(),
      summary: String(data.get("summary") ?? "").trim(),
      knowledgeBase: base,
      category: String(data.get("category") || categories[0] || "General"),
      state: "Draft",
      authorId: currentUser.id,
      views: 0,
      helpful: 0,
      notHelpful: 0,
      updated: NOW.toISOString(),
      tags,
    }
    knowledgeStore.add(article)
    toast.success(`Draft ${number} created`, {
      description: article.title,
    })
    setDirty(false)
    leave()
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New article
      </Button>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        <form
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="flex h-full min-h-0 flex-col"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>New article</SheetTitle>
            <SheetDescription>
              Start a draft. Articles go through Review before they are
              published and suggested on incidents.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup className="gap-6">
              <FieldSet>
                <FieldLegend variant="label">Article</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="kb-title">Title</FieldLabel>
                  <Input
                    id="kb-title"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. How to request a replacement badge"
                    maxLength={120}
                    required
                    autoFocus
                  />
                  <div className="flex items-start justify-between gap-3">
                    <FieldDescription>
                      Write it the way someone would search for it.
                    </FieldDescription>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {title.length}/120
                    </span>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="kb-summary">Summary</FieldLabel>
                  <Textarea
                    id="kb-summary"
                    name="summary"
                    placeholder="One or two sentences shown in search results and on incident records."
                    className="min-h-20"
                    required
                  />
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Where it lives</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="kb-base">Knowledge base</FieldLabel>
                    <Select
                      value={base}
                      onValueChange={(v) => v && setBase(v as KnowledgeBase)}
                    >
                      <SelectTrigger id="kb-base" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {knowledgeBases.map((k) => (
                          <SelectItem key={k} value={k}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="kb-category">Category</FieldLabel>
                    <Select
                      name="category"
                      key={base}
                      defaultValue={categories[0]}
                    >
                      <SelectTrigger id="kb-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="kb-tags">Tags</FieldLabel>
                  <Input
                    id="kb-tags"
                    name="tags"
                    placeholder="vpn, remote, known-error"
                  />
                  <FieldDescription>
                    Comma separated. Tags are searchable on the list.
                  </FieldDescription>
                </Field>
              </FieldSet>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            tertiary={
              <span className="text-xs text-muted-foreground">
                {dirty ? "Unsaved draft" : "Nothing entered yet"}
              </span>
            }
            primary={
              <Button type="submit">
                <PlusIcon /> Create draft
              </Button>
            }
          />
        </form>
      </SheetContent>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this article?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved details. They will be lost if you close the form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                leave()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
