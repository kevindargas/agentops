"use client"

import * as React from "react"
import { cn } from "cn"
import { FlaskConicalIcon, RocketIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { MetricTile } from "@/components/shared/metric-tile"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { sampleAssessment, sampleSnapshots } from "@/lib/data/readiness"
import {
  autonomyLabel,
  exposureLabel,
  maturityTargetHint,
  maturityTargetLabel,
  regulatoryLabel,
  sensitivityLabel,
  systemTypeHint,
  systemTypeLabel,
} from "@/lib/readiness/labels"
import { applicabilityOf, isRequired } from "@/lib/readiness/scoring"
import { readinessActions } from "@/lib/readiness/store"
import {
  autonomyLevels,
  dataSensitivities,
  maturityTargets,
  regulatoryScopes,
  systemTypes,
  userExposures,
  type AutonomyLevel,
  type ControlSet,
  type DataSensitivity,
  type MaturityTarget,
  type RegulatoryScope,
  type SystemProfile,
  type SystemType,
  type UserExposure,
} from "@/lib/readiness/types"
import { DomainChip, useReadiness } from "./shared"

const defaultProfile: SystemProfile = {
  name: "",
  systemType: "agent",
  autonomy: "supervised",
  dataSensitivity: "internal",
  exposure: "internal",
  regulatory: [],
}

const autonomyItems = autonomyLevels.map((v) => ({
  value: v,
  label: autonomyLabel[v],
}))
const sensitivityItems = dataSensitivities.map((v) => ({
  value: v,
  label: sensitivityLabel[v],
}))

/**
 * First screen of the readiness assessment: describe the system, pick the
 * maturity target and see live how the profile changes the control set.
 * Mounted with `key` on the assessment id so edit mode re-initialises when a
 * different assessment is loaded.
 */
export function SetupForm({ mode }: { mode: "create" | "edit" }) {
  const { assessment, controlSet } = useReadiness()
  const editing = mode === "edit" && assessment !== null
  return (
    <SetupFormBody
      key={editing ? assessment.id : "new"}
      mode={mode}
      controlSet={controlSet}
      initialProfile={editing ? assessment.profile : defaultProfile}
      initialTarget={editing ? assessment.target : "pilot"}
    />
  )
}

function SetupFormBody({
  mode,
  controlSet,
  initialProfile,
  initialTarget,
}: {
  mode: "create" | "edit"
  controlSet: ControlSet
  initialProfile: SystemProfile
  initialTarget: MaturityTarget
}) {
  const id = React.useId()
  const [profile, setProfile] = React.useState<SystemProfile>(initialProfile)
  const [target, setTarget] = React.useState<MaturityTarget>(initialTarget)
  const [touched, setTouched] = React.useState(false)

  const patch = (p: Partial<SystemProfile>) =>
    setProfile((prev) => ({ ...prev, ...p }))

  const name = profile.name.trim()
  const nameMissing = name.length === 0

  const impact = React.useMemo(
    () => computeImpact(controlSet, profile, target),
    [controlSet, profile, target]
  )

  const requiredAt = React.useMemo(() => {
    const out = {} as Record<MaturityTarget, number>
    for (const t of maturityTargets)
      out[t] = controlSet.controls.filter(
        (c) =>
          applicabilityOf(c, profile) !== "not-applicable" && isRequired(c, t)
      ).length
    return out
  }, [controlSet, profile])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (nameMissing) return
    const next = { ...profile, name }
    if (mode === "create") {
      readinessActions.start(next, target)
      toast.success("Assessment started", {
        description: `${name} · ${impact.required} controls required at ${maturityTargetLabel[target].toLowerCase()}.`,
      })
    } else {
      readinessActions.updateProfile(next, target)
      toast.success("Profile updated", {
        description: `${impact.applies + impact.reduced} controls now apply, ${impact.required} required.`,
      })
    }
  }

  const loadSample = () => {
    readinessActions.load(sampleAssessment)
    sampleSnapshots.forEach(readinessActions.addSnapshot)
    toast.success("Sample assessment loaded", {
      description: `${sampleAssessment.name} with ${sampleSnapshots.length} snapshot${sampleSnapshots.length === 1 ? "" : "s"}.`,
    })
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex min-w-0 flex-col gap-8">
        {/* System name */}
        <Section
          title="System"
          description="What are you assessing? The name becomes the assessment title."
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>System name</Label>
            <Input
              id={`${id}-name`}
              value={profile.name}
              onChange={(e) => patch({ name: e.target.value })}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Support Triage Agent"
              autoComplete="off"
              aria-invalid={touched && nameMissing ? true : undefined}
              className="max-w-md"
            />
            {touched && nameMissing && (
              <p className="text-xs text-danger-text">
                Give the system a name.
              </p>
            )}
          </div>
        </Section>

        {/* System type */}
        <Section
          title="System type"
          description="Retrieval and tool use decide which controls apply."
        >
          <RadioGroup
            value={profile.systemType}
            onValueChange={(v) => patch({ systemType: v as SystemType })}
            aria-label="System type"
            className="grid gap-2 sm:grid-cols-2"
          >
            {systemTypes.map((t) => (
              <OptionCard
                key={t}
                id={`${id}-type-${t}`}
                value={t}
                label={systemTypeLabel[t]}
                hint={systemTypeHint[t]}
              />
            ))}
          </RadioGroup>
        </Section>

        {/* Risk profile */}
        <Section
          title="Risk profile"
          description="Autonomy, data and audience raise the bar for safety and governance controls."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-autonomy`}>Autonomy level</Label>
              <Select
                value={profile.autonomy}
                onValueChange={(v) =>
                  v && patch({ autonomy: v as AutonomyLevel })
                }
                items={autonomyItems}
              >
                <SelectTrigger id={`${id}-autonomy`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autonomyItems.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-sensitivity`}>Data sensitivity</Label>
              <Select
                value={profile.dataSensitivity}
                onValueChange={(v) =>
                  v && patch({ dataSensitivity: v as DataSensitivity })
                }
                items={sensitivityItems}
              >
                <SelectTrigger id={`${id}-sensitivity`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sensitivityItems.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">User exposure</span>
              <ToggleGroup
                multiple={false}
                value={[profile.exposure]}
                onValueChange={(v) =>
                  v[0] && patch({ exposure: v[0] as UserExposure })
                }
                variant="outline"
                spacing={0}
                aria-label="User exposure"
              >
                {userExposures.map((x) => (
                  <ToggleGroupItem key={x} value={x} className="px-3">
                    {exposureLabel[x]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </Section>

        {/* Regulatory scope */}
        <Section
          title="Regulatory scope"
          description="Select everything that applies. Controls tagged to a scope only count when it is selected."
        >
          <div className="grid gap-1 rounded-lg border p-2 sm:grid-cols-2 lg:grid-cols-3">
            {regulatoryScopes.map((r) => {
              const checked = profile.regulatory.includes(r)
              const cid = `${id}-reg-${r}`
              return (
                <label
                  key={r}
                  htmlFor={cid}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                    !checked && "text-muted-foreground"
                  )}
                >
                  <Checkbox
                    id={cid}
                    checked={checked}
                    onCheckedChange={(c) =>
                      patch({
                        regulatory: c
                          ? [...profile.regulatory, r]
                          : profile.regulatory.filter(
                              (x): x is RegulatoryScope => x !== r
                            ),
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {regulatoryLabel[r]}
                  </span>
                </label>
              )
            })}
          </div>
        </Section>

        {/* Maturity target */}
        <Section
          title="Maturity target"
          description="Which stage are you heading for? Controls required at or before this stage count in full; later ones at half weight."
        >
          <RadioGroup
            value={target}
            onValueChange={(v) => setTarget(v as MaturityTarget)}
            aria-label="Maturity target"
            className="grid gap-2 sm:grid-cols-3"
          >
            {maturityTargets.map((t) => (
              <OptionCard
                key={t}
                id={`${id}-target-${t}`}
                value={t}
                label={maturityTargetLabel[t]}
                hint={maturityTargetHint[t]}
                meta={`${requiredAt[t]} required`}
                icon={targetIcon[t]}
              />
            ))}
          </RadioGroup>
        </Section>

        <div className="flex flex-wrap items-center gap-2 border-t pt-5">
          <Button type="submit">
            {mode === "create" ? "Start assessment" : "Save profile"}
          </Button>
          {mode === "create" && (
            <Button type="button" variant="outline" onClick={loadSample}>
              <SparklesIcon /> Load sample assessment
            </Button>
          )}
          <p className="text-xs text-muted-foreground sm:ml-auto">
            Stored in this browser only. Nothing is uploaded.
          </p>
        </div>
      </div>

      <ImpactPanel
        controlSet={controlSet}
        profile={profile}
        target={target}
        impact={impact}
      />
    </form>
  )
}

const targetIcon: Record<MaturityTarget, React.ReactNode> = {
  prototype: <FlaskConicalIcon />,
  pilot: <SparklesIcon />,
  production: <RocketIcon />,
}

// ---- Impact ------------------------------------------------------------------

interface Impact {
  applies: number
  reduced: number
  hidden: number
  required: number
  gates: number
  byDomain: { domainId: string; applicable: number; required: number }[]
}

function computeImpact(
  set: ControlSet,
  profile: SystemProfile,
  target: MaturityTarget
): Impact {
  const impact: Impact = {
    applies: 0,
    reduced: 0,
    hidden: 0,
    required: 0,
    gates: 0,
    byDomain: set.domains.map((d) => ({
      domainId: d.id,
      applicable: 0,
      required: 0,
    })),
  }
  for (const c of set.controls) {
    const a = applicabilityOf(c, profile)
    if (a === "applies") impact.applies++
    else if (a === "reduced") impact.reduced++
    else {
      impact.hidden++
      continue
    }
    const dom = impact.byDomain.find((d) => d.domainId === c.domain)
    if (dom) dom.applicable++
    if (isRequired(c, target)) {
      impact.required++
      if (dom) dom.required++
      if (c.gate) impact.gates++
    }
  }
  return impact
}

function ImpactPanel({
  controlSet,
  profile,
  target,
  impact,
}: {
  controlSet: ControlSet
  profile: SystemProfile
  target: MaturityTarget
  impact: Impact
}) {
  const total = controlSet.controls.length
  return (
    <aside
      aria-live="polite"
      className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-4"
    >
      <div>
        <h3 className="text-sm font-semibold">What this profile changes</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {controlSet.name} · {total} controls
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ImpactStat label="Apply in full" value={impact.applies} />
        <ImpactStat label="Down-weighted" value={impact.reduced} />
        <ImpactStat label="Hidden" value={impact.hidden} muted />
        <ImpactStat
          label={`Required at ${maturityTargetLabel[target].toLowerCase()}`}
          value={impact.required}
          hint={
            impact.gates > 0
              ? `${impact.gates} release gate${impact.gates === 1 ? "" : "s"}`
              : undefined
          }
          accent
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-medium text-muted-foreground">
          Required per domain
        </span>
        <ul className="divide-y divide-border/70 rounded-lg border">
          {controlSet.domains.map((d) => {
            const row = impact.byDomain.find((x) => x.domainId === d.id)
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 px-2.5 py-1.5"
              >
                <DomainChip domain={d} short />
                <span className="font-mono text-xs tabular-nums">
                  <span className="font-semibold">{row?.required ?? 0}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {row?.applicable ?? 0}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {systemTypeLabel[profile.systemType]},{" "}
        {autonomyLabel[profile.autonomy].split(": ")[0].toLowerCase()},{" "}
        {sensitivityLabel[profile.dataSensitivity].toLowerCase()} data for{" "}
        {exposureLabel[profile.exposure].toLowerCase()}
        {profile.regulatory.length > 0
          ? ` under ${profile.regulatory.map((r) => regulatoryLabel[r]).join(", ")}`
          : ""}
        .
      </p>
    </aside>
  )
}

function ImpactStat({
  label,
  value,
  hint,
  muted = false,
  accent = false,
}: {
  label: string
  value: number
  hint?: string
  muted?: boolean
  accent?: boolean
}) {
  return (
    <MetricTile
      label={label}
      value={accent ? <span className="text-brand">{value}</span> : value}
      hint={hint}
      tone={muted ? "muted" : undefined}
      className={cn(accent && "border-brand/30 bg-brand/5")}
    />
  )
}

// ---- Primitives --------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function OptionCard({
  id,
  value,
  label,
  hint,
  meta,
  icon,
}: {
  id: string
  value: string
  label: string
  hint: string
  meta?: string
  icon?: React.ReactNode
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30",
        "has-data-checked:border-ring has-data-checked:bg-muted/40"
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-xs leading-snug font-normal text-muted-foreground">
          {hint}
        </span>
        {meta && (
          <span className="mt-1 font-mono text-2xs font-normal text-muted-foreground tabular-nums">
            {meta}
          </span>
        )}
      </span>
    </Label>
  )
}
