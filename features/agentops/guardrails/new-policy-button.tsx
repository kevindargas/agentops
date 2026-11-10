"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Guardrail } from "@/lib/data/guardrails"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { recordAudit } from "../audit/audit-store"
import { policyStore } from "./store"

/**
 * Primary create action for the Guardrails page. There is no YAML editor in
 * the template, so a new policy always starts as a Draft copy of an existing
 * one; the copy lands in the shared policy store and opens in the sheet.
 */
export function NewPolicyButton() {
  const router = useRouter()
  const policies = policyStore.use()
  const [open, setOpen] = React.useState(false)
  const [sourceId, setSourceId] = React.useState<string | null>(null)
  const items = policies
    .filter((g) => !g.id.endsWith("-copy"))
    .map((g) => ({ value: g.id, label: `${g.name} · ${g.category}` }))

  function create() {
    const src = policyStore.get().find((g) => g.id === sourceId)
    if (!src) return
    let copyId = `${src.id}-copy`
    let n = 2
    while (policyStore.get().some((g) => g.id === copyId))
      copyId = `${src.id}-copy-${n++}`
    const now = clock().toISOString()
    const copy: Guardrail = {
      ...src,
      id: copyId,
      name: `${src.name} (draft)`,
      status: "Draft",
      triggers24h: 0,
      history: src.history.map(() => 0),
      falsePositiveRate: 0,
      ownerId: currentUser.id,
      updated: now,
      policy: src.policy.replace(
        /^id: .*$/m,
        `id: ${copyId.replace(/^grd-/, "")}`
      ),
      versions: [
        {
          version: "v1.0",
          changed: now,
          authorId: currentUser.id,
          summary: `Drafted from ${src.name}`,
        },
      ],
    }
    policyStore.add(copy, "end")
    recordAudit({
      action: "guardrail.policy.created",
      source: "guardrail",
      target: {
        kind: "guardrail",
        id: copy.id,
        label: copy.name,
        href: `/agentops/guardrails?policy=${copy.id}`,
      },
      summary: `Created draft policy "${copy.name}" from ${src.name}`,
      context: { policyVersion: "v1.0" },
    })
    setOpen(false)
    toast.success("Draft policy created", {
      description: `${copy.name} is a Draft: it does not evaluate or count toward coverage until enabled.`,
    })
    router.push(`/agentops/guardrails?policy=${copy.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon /> New policy
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New policy</DialogTitle>
          <DialogDescription>
            Start from an existing policy. The copy is created as a Draft with
            the same engine, scope and YAML, ready to retune in the sheet.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-policy-source">Start from</FieldLabel>
          <Select
            value={sourceId}
            onValueChange={(v) => setSourceId(v ? String(v) : null)}
            items={items}
          >
            <SelectTrigger id="new-policy-source" className="w-full">
              <SelectValue placeholder="Pick a policy to copy" />
            </SelectTrigger>
            <SelectContent>
              {items.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            A YAML editor is not part of this template; duplicate, then adjust
            threshold and scope.
          </FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!sourceId}>
            <PlusIcon /> Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
