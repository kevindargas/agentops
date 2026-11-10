"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  PaintbrushIcon,
  RotateCcwIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { withThemeTransition } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  accents,
  densities,
  radii,
  sameThemeSettings,
  sidebarStyles,
  stylePresets,
  surfaces,
  type ThemeSettings,
} from "@/lib/theme-presets"
import { useCustomizer } from "./customizer-provider"

function GroupLabel({
  children,
  hint,
  id,
}: {
  children: React.ReactNode
  hint?: React.ReactNode
  id?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p id={id} className="eyebrow">
        {children}
      </p>
      {hint && (
        <span className="truncate text-2xs text-muted-foreground/80">
          {hint}
        </span>
      )}
    </div>
  )
}

/** Compact miniature of the app that reflects a preset's accent, radius, surface and sidebar style. */
function PresetThumb({
  settings,
  dark,
}: {
  settings: ThemeSettings
  dark: boolean
}) {
  const accent = accents.find((a) => a.id === settings.accent)!
  const radius =
    settings.radius === "none"
      ? "0px"
      : settings.radius === "sm"
        ? "3px"
        : settings.radius === "lg"
          ? "7px"
          : settings.radius === "xl"
            ? "10px"
            : "5px"
  const bg = dark ? "oklch(0.142 0.006 262)" : "oklch(0.993 0.0015 262)"
  const card = dark ? "oklch(0.198 0.007 262)" : "oklch(1 0 0)"
  const side = dark ? "oklch(0.172 0.007 262)" : "oklch(0.975 0.003 262)"
  const line = dark ? "oklch(1 0 0 / 12%)" : "oklch(0.905 0.006 262)"
  const ink = dark ? "oklch(1 0 0 / 28%)" : "oklch(0.165 0.012 265 / 22%)"
  const swatch = dark ? accent.swatchDark : accent.swatch
  const shadow =
    settings.surface === "elevated" ? "var(--shadow-raised)" : undefined
  const compact = settings.density === "compact"
  return (
    <div
      className="flex h-16 w-full overflow-hidden rounded-md border"
      style={{
        background: settings.sidebar === "inset" ? side : bg,
        borderColor: line,
      }}
      aria-hidden
    >
      <div
        className={cn(
          "flex w-6 shrink-0 flex-col gap-1 p-1",
          settings.sidebar === "floating" && "m-1 rounded-sm",
          settings.sidebar === "sidebar" && "border-r"
        )}
        style={{
          background: settings.sidebar === "floating" ? card : side,
          borderColor: line,
          boxShadow: settings.sidebar === "floating" ? shadow : undefined,
        }}
      >
        <div
          className="h-1.5 w-full rounded-sm"
          style={{ background: swatch }}
        />
        <div className="h-1 w-full rounded-sm" style={{ background: ink }} />
        <div className="h-1 w-3/4 rounded-sm" style={{ background: ink }} />
        <div className="h-1 w-full rounded-sm" style={{ background: ink }} />
      </div>
      <div
        className={cn(
          "flex flex-1 flex-col p-1.5",
          compact ? "gap-0.5" : "gap-1",
          settings.sidebar === "inset" && "m-1 ml-0 rounded-sm"
        )}
        style={{
          background: settings.sidebar === "inset" ? bg : "transparent",
          borderRadius: settings.sidebar === "inset" ? radius : undefined,
          boxShadow: settings.sidebar === "inset" ? shadow : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-8 rounded-sm" style={{ background: ink }} />
          <div
            className="h-2.5 w-5"
            style={{ background: swatch, borderRadius: radius }}
          />
        </div>
        <div
          className={cn(
            "grid flex-1 gap-1",
            compact ? "grid-cols-4" : "grid-cols-3"
          )}
        >
          {Array.from({ length: compact ? 4 : 3 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col justify-end gap-0.5 p-1"
              style={{
                background: card,
                border: `1px solid ${line}`,
                borderRadius: radius,
                boxShadow: shadow,
              }}
            >
              <div
                className="h-0.5 w-2/3 rounded-sm"
                style={{ background: ink }}
              />
              <div
                className="h-1 w-1/2 rounded-sm"
                style={{ background: i === 0 ? swatch : ink }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Real components rendered with the live tokens so the user sees exactly what changes. */
function LivePreview({ settings }: { settings: ThemeSettings }) {
  const accent = accents.find((a) => a.id === settings.accent)!
  return (
    <div
      className="flex items-center gap-2 overflow-hidden rounded-lg border bg-background p-2 ring-1 ring-foreground/5 ring-inset"
      aria-hidden
    >
      <span className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-xs">
        Primary
      </span>
      <span className="inline-flex h-7 items-center rounded-lg border border-input bg-card px-2.5 text-xs font-medium">
        Outline
      </span>
      <span className="inline-flex h-5 items-center gap-1.5 rounded-4xl border border-brand/25 bg-brand/10 px-2 text-2xs font-medium text-brand">
        <span className="size-1.5 rounded-full bg-brand" />
        In Progress
      </span>
      <span className="ml-auto hidden h-7 min-w-0 flex-1 items-center truncate rounded-lg border border-input bg-card px-2 text-xs text-muted-foreground sm:inline-flex">
        {accent.label} accent…
      </span>
    </div>
  )
}

export function ThemeCustomizer() {
  const { settings, update, reset, isDefault } = useCustomizer()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const activePreset = stylePresets.find((p) =>
    sameThemeSettings(p.settings, settings)
  )
  const activeAccent = accents.find((a) => a.id === settings.accent)!

  function changeMode(next: string) {
    withThemeTransition(() => setTheme(next))
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Customize theme"
                  className="relative"
                />
              }
            />
          }
        >
          <PaintbrushIcon />
          <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-primary ring-2 ring-background transition-colors" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Customize theme</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(392px,calc(100vw-1rem))] gap-0 p-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Appearance</p>
            <p className="truncate text-xs text-muted-foreground">
              {activePreset ? (
                <>
                  <span className="font-medium text-foreground/80">
                    {activePreset.label}
                  </span>{" "}
                  style
                </>
              ) : (
                "Custom style"
              )}
              {" · "}
              {activeAccent.label.toLowerCase()} accent
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={isDefault}
                  aria-label="Reset to defaults"
                />
              }
            >
              <RotateCcwIcon /> Reset
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Back to the default look
            </TooltipContent>
          </Tooltip>
        </div>
        <Separator />
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">
          <div className="flex flex-col gap-5 p-4">
            <LivePreview settings={settings} />

            <div className="flex flex-col gap-2">
              <GroupLabel
                id="theme-mode-label"
                hint={
                  <span className="inline-flex items-center gap-1">
                    press <Kbd>D</Kbd> to toggle
                  </span>
                }
              >
                Mode
              </GroupLabel>
              <ToggleGroup
                multiple={false}
                value={[theme ?? "system"]}
                onValueChange={(v) => v[0] && changeMode(v[0])}
                variant="outline"
                aria-labelledby="theme-mode-label"
                className="w-full *:data-[slot=toggle-group-item]:flex-1"
              >
                <ToggleGroupItem value="light" aria-label="Light">
                  <SunIcon /> Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label="Dark">
                  <MoonIcon /> Dark
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label="System">
                  <MonitorIcon /> Auto
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-2">
              <GroupLabel hint="one-click looks">Style</GroupLabel>
              <div
                role="radiogroup"
                aria-label="Style preset"
                className="grid grid-cols-2 gap-2"
              >
                {stylePresets.map((p) => {
                  const active = activePreset?.id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => update(p.settings)}
                      className={cn(
                        "group relative flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-[background-color,border-color,box-shadow] outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active
                          ? "border-primary/60 bg-primary/[0.04] ring-2 ring-primary/20"
                          : "border-border"
                      )}
                    >
                      <PresetThumb settings={p.settings} dark={dark} />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{p.label}</span>
                        <span
                          className={cn(
                            "inline-flex size-4 items-center justify-center rounded-full transition-[background-color,color,transform]",
                            active
                              ? "scale-100 bg-primary text-primary-foreground"
                              : "scale-75 bg-transparent text-transparent"
                          )}
                          aria-hidden
                        >
                          <CheckIcon className="size-3" strokeWidth={3} />
                        </span>
                      </div>
                      <span className="line-clamp-1 text-2xs text-muted-foreground">
                        {p.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <GroupLabel hint={activeAccent.description}>Accent</GroupLabel>
              <div
                role="radiogroup"
                aria-label="Accent color"
                className="flex flex-wrap gap-2"
              >
                {accents.map((a) => {
                  const active = settings.accent === a.id
                  return (
                    <Tooltip key={a.id}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            role="radio"
                            aria-label={a.label}
                            aria-checked={active}
                            onClick={() => update({ accent: a.id })}
                            className={cn(
                              "relative flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-[box-shadow,transform] outline-none hover:scale-105 hover:ring-2 hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
                              active &&
                                "ring-2 ring-foreground hover:ring-foreground"
                            )}
                            style={{
                              background: dark ? a.swatchDark : a.swatch,
                            }}
                          />
                        }
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-foreground/10 ring-inset"
                        />
                        {active && (
                          <CheckIcon
                            className="size-3.5 text-brand-foreground drop-shadow-sm"
                            strokeWidth={3}
                          />
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{a.label}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <GroupLabel
                id="theme-radius-label"
                hint={radii.find((r) => r.id === settings.radius)?.value}
              >
                Radius
              </GroupLabel>
              <ToggleGroup
                multiple={false}
                value={[settings.radius]}
                onValueChange={(v) =>
                  v[0] && update({ radius: v[0] as ThemeSettings["radius"] })
                }
                variant="outline"
                aria-labelledby="theme-radius-label"
                className="w-full *:data-[slot=toggle-group-item]:flex-1"
              >
                {radii.map((r) => (
                  <ToggleGroupItem
                    key={r.id}
                    value={r.id}
                    className="h-auto flex-col gap-1 py-1.5 text-2xs"
                  >
                    <span
                      className="size-4 border-t-2 border-l-2 border-current"
                      style={{
                        borderTopLeftRadius:
                          r.value === "0rem" ? 0 : `calc(${r.value} * 0.8)`,
                      }}
                    />
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <GroupLabel id="theme-density-label">Density</GroupLabel>
                <ToggleGroup
                  multiple={false}
                  value={[settings.density]}
                  onValueChange={(v) =>
                    v[0] &&
                    update({ density: v[0] as ThemeSettings["density"] })
                  }
                  variant="outline"
                  aria-labelledby="theme-density-label"
                  className="w-full *:data-[slot=toggle-group-item]:flex-1"
                >
                  {densities.map((d) => (
                    <ToggleGroupItem
                      key={d.id}
                      value={d.id}
                      className="text-xs"
                      title={d.description}
                    >
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="flex flex-col gap-2">
                <GroupLabel id="theme-surface-label">Surface</GroupLabel>
                <ToggleGroup
                  multiple={false}
                  value={[settings.surface]}
                  onValueChange={(v) =>
                    v[0] &&
                    update({ surface: v[0] as ThemeSettings["surface"] })
                  }
                  variant="outline"
                  aria-labelledby="theme-surface-label"
                  className="w-full *:data-[slot=toggle-group-item]:flex-1"
                >
                  {surfaces.map((d) => (
                    <ToggleGroupItem
                      key={d.id}
                      value={d.id}
                      className="text-xs"
                      title={d.description}
                    >
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <GroupLabel
                hint={
                  sidebarStyles.find((s) => s.id === settings.sidebar)
                    ?.description
                }
              >
                Sidebar
              </GroupLabel>
              <div
                role="radiogroup"
                aria-label="Sidebar style"
                className="grid grid-cols-3 gap-2"
              >
                {sidebarStyles.map((s) => {
                  const active = settings.sidebar === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => update({ sidebar: s.id })}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-lg border p-2 text-left text-xs transition-[background-color,border-color,box-shadow] outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active
                          ? "border-primary/60 bg-primary/[0.04] ring-2 ring-primary/20"
                          : "border-border"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-full gap-0.5 overflow-hidden rounded-sm border p-0.5",
                          s.id === "inset" ? "bg-muted/60" : "bg-background"
                        )}
                      >
                        <div
                          className={cn(
                            "w-3.5 shrink-0 bg-foreground/15",
                            s.id === "floating" &&
                              "my-0.5 ml-0.5 rounded-sm shadow-xs",
                            s.id === "sidebar" &&
                              "rounded-none border-r border-border"
                          )}
                        />
                        <div
                          className={cn(
                            "flex-1 bg-card",
                            s.id === "inset" &&
                              "my-0.5 mr-0.5 rounded-sm border",
                            s.id === "floating" && "ml-0.5"
                          )}
                        />
                      </div>
                      <span className="flex w-full items-center justify-between font-medium">
                        {s.label}
                        {active && (
                          <CheckIcon
                            className="size-3 text-primary"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <Separator />
        <p className="px-4 py-2.5 text-2xs text-muted-foreground">
          Saved to this browser only. Mode follows your OS when set to Auto.
        </p>
      </PopoverContent>
    </Popover>
  )
}
