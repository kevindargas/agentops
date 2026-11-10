"use client"

import { UsersRoundIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserChip } from "@/components/shared/user-chip"
import type { Group } from "@/lib/types"
import { groupsStore } from "./users-store"

export const groupTypeLabel: Record<Group["type"], string> = {
  itil: "ITIL",
  fulfillment: "Fulfillment",
  approval: "Approval",
  hr: "People",
  cab: "CAB",
}

/** One card per assignment group, read from the shared store so "New group" shows up immediately. */
export function GroupsGrid() {
  const list = groupsStore.use()
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((g) => (
        <Card key={g.id} className="lift">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <UsersRoundIcon className="size-4" />
                </div>
                <CardTitle className="leading-tight">{g.name}</CardTitle>
              </div>
              <Badge variant="secondary">{groupTypeLabel[g.type]}</Badge>
            </div>
            <CardDescription className="line-clamp-2">
              {g.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex items-center justify-between border-t pt-4 text-sm">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              Manager <UserChip userId={g.manager} size="xs" />
            </span>
            <span className="text-muted-foreground tabular-nums">
              {g.members} member{g.members === 1 ? "" : "s"}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
