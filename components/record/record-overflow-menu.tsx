"use client"

import * as React from "react"
import Link from "next/link"
import { MoreHorizontalIcon } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Serializable overflow item so server pages can describe the menu.
 * Selecting an item shows `message` (or the label) as a toast; destructive items
 * ask for confirmation first.
 */
export interface RecordOverflowItem {
  label: string
  icon?: React.ReactNode
  href?: string
  /** Toast text shown after the action runs. Defaults to the label. */
  message?: string
  destructive?: boolean
  /** Confirmation copy for destructive actions. */
  confirm?: { title?: string; description?: string; actionLabel?: string }
  separatorBefore?: boolean
  disabled?: boolean
}

export function RecordOverflowMenu({
  items,
  number,
  label = "More actions",
}: {
  items: RecordOverflowItem[]
  number?: string
  label?: string
}) {
  const [pending, setPending] = React.useState<RecordOverflowItem | null>(null)

  function run(item: RecordOverflowItem) {
    const message =
      item.message ?? `${item.label}${number ? ` · ${number}` : ""}`
    if (item.destructive) toast(message)
    else toast.success(message)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label={label} />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {number && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-mono">
                {number}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          )}
          {items.map((item, i) => (
            <React.Fragment key={item.label}>
              {item.separatorBefore && i > 0 && <DropdownMenuSeparator />}
              {item.href ? (
                <DropdownMenuItem
                  disabled={item.disabled}
                  render={<Link href={item.href} />}
                >
                  {item.icon} {item.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={item.disabled}
                  variant={item.destructive ? "destructive" : "default"}
                  onClick={() =>
                    item.destructive ? setPending(item) : run(item)
                  }
                >
                  {item.icon} {item.label}
                </DropdownMenuItem>
              )}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.confirm?.title ?? `${pending?.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.confirm?.description ??
                `This will ${pending?.label.toLowerCase()}${number ? ` for ${number}` : ""}. You can reverse it later from the activity stream.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) run(pending)
                setPending(null)
              }}
            >
              {pending?.confirm?.actionLabel ?? pending?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
