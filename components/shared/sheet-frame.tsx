"use client"

import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { SheetClose, SheetFooter } from "@/components/ui/sheet"

/**
 * Standard sheet widths. Pass as the `SheetContent` className together with
 * the layout classes: `className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}`.
 */
export const sheetWidths = {
  /** Read-only detail panels (tool, policy, audit event). */
  detail: "sm:max-w-xl",
  /** Editors and multi-section forms. */
  editor: "sm:max-w-2xl",
} as const

/** Scrollable middle region between `SheetHeader` and the footer. */
export function SheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  )
}

export interface SheetFooterActionsProps {
  /** Right-most, default variant button (Save, Create, Apply). */
  primary?: React.ReactNode
  /** Outline button to the left of the primary. */
  secondary?: React.ReactNode
  /** Ghost or destructive action pinned to the left edge. */
  tertiary?: React.ReactNode
  /** Label of the built-in close button. Reads "Close" when there is no primary action. */
  cancelLabel?: string
  hideCancel?: boolean
  className?: string
}

/**
 * Sheet footer with one button order for the whole app: tertiary left,
 * then Cancel, secondary and primary on the right. Renders a Close button
 * by itself when no actions are passed so every sheet is dismissable without
 * hunting for the X.
 */
export function SheetFooterActions({
  primary,
  secondary,
  tertiary,
  cancelLabel,
  hideCancel = false,
  className,
}: SheetFooterActionsProps) {
  const closeLabel = cancelLabel ?? (primary || secondary ? "Cancel" : "Close")
  return (
    <SheetFooter
      className={cn(
        "flex-row items-center justify-between gap-2 border-t px-6 py-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">{tertiary}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {!hideCancel && (
          <SheetClose render={<Button variant="outline" />}>
            {closeLabel}
          </SheetClose>
        )}
        {secondary}
        {primary}
      </div>
    </SheetFooter>
  )
}
