import { clock } from "@/lib/data/seed"
import { createStore } from "@/lib/store"

import { defaultControlSet } from "./controls"
import type {
  Assessment,
  ControlResponse,
  ControlSet,
  MaturityTarget,
  Snapshot,
  SystemProfile,
} from "./types"

export interface ReadinessState {
  assessment: Assessment | null
  snapshots: Snapshot[]
  showNotApplicable: boolean
  /** Name used when voting in team mode. */
  respondent: string
  /** Imported control set that replaces the default catalog, if any. */
  customControlSet: ControlSet | null
}

const STORAGE_KEY = "agentops.readiness.v1"

const initialState: ReadinessState = {
  assessment: null,
  snapshots: [],
  showNotApplicable: false,
  respondent: "",
  customControlSet: null,
}

/**
 * Everything lives in the browser (localStorage): nothing is sent anywhere.
 * `reset()` wipes it.
 */
export const readinessStore = createStore<ReadinessState>(
  initialState,
  STORAGE_KEY
)

/**
 * `false` during server rendering and the hydration pass, `true` once the
 * store has been subscribed to on the client (which loads localStorage).
 * Pages render a skeleton until then so the empty seed never flashes.
 */
export function useReadinessHydrated() {
  return readinessStore.useHydrated()
}

/** Label of the snapshot taken automatically before an import replaces the assessment. */
export const BEFORE_IMPORT_LABEL = "Before import"

function nowIso() {
  return clock().toISOString()
}

/**
 * Deterministic ids: a prefix, the demo clock and a counter that continues
 * from the highest suffix already in the store, so reloads never collide.
 */
function newId(prefix: "asm" | "snap", existing: string[]) {
  const stamp = clock().getTime().toString(36)
  const re = new RegExp(`^${prefix}-${stamp}-(\\d+)$`)
  const max = existing.reduce((acc, id) => {
    const m = re.exec(id)
    return m ? Math.max(acc, Number(m[1])) : acc
  }, 0)
  return `${prefix}-${stamp}-${max + 1}`
}

function existingIds(s: ReadinessState) {
  return [
    ...(s.assessment ? [s.assessment.id] : []),
    ...s.snapshots.flatMap((x) => [x.id, x.assessment.id]),
  ]
}

export function createAssessment(
  profile: SystemProfile,
  target: MaturityTarget,
  name = profile.name
): Assessment {
  const ts = nowIso()
  return {
    id: newId("asm", existingIds(readinessStore.get())),
    name,
    controlSetId: defaultControlSet.id,
    controlSetVersion: defaultControlSet.version,
    profile,
    target,
    responses: {},
    respondents: [],
    createdAt: ts,
    updatedAt: ts,
  }
}

function withSnapshot(s: ReadinessState, label: string): ReadinessState {
  if (!s.assessment) return s
  const snap: Snapshot = {
    id: newId("snap", existingIds(s)),
    label: label.trim() || `Snapshot ${s.snapshots.length + 1}`,
    takenAt: nowIso(),
    assessment: structuredClone(s.assessment),
  }
  return { ...s, snapshots: [snap, ...s.snapshots].slice(0, 25) }
}

export const readinessActions = {
  start(profile: SystemProfile, target: MaturityTarget) {
    readinessStore.set({ assessment: createAssessment(profile, target) })
  },
  load(assessment: Assessment) {
    readinessStore.set({ assessment })
  },
  /**
   * Replace the current assessment, filing the one being replaced as a
   * snapshot first so nothing is lost. Returns whether a snapshot was taken.
   */
  replace(assessment: Assessment, snapshotLabel = BEFORE_IMPORT_LABEL) {
    const had = readinessStore.get().assessment !== null
    readinessStore.set((s) => ({
      ...withSnapshot(s, snapshotLabel),
      assessment,
    }))
    return had
  },
  updateProfile(profile: SystemProfile, target: MaturityTarget) {
    readinessStore.set((s) =>
      s.assessment
        ? {
            ...s,
            assessment: {
              ...s.assessment,
              name:
                s.assessment.name === s.assessment.profile.name
                  ? profile.name
                  : s.assessment.name,
              profile,
              target,
              updatedAt: nowIso(),
            },
          }
        : s
    )
  },
  rename(name: string) {
    readinessStore.set((s) =>
      s.assessment
        ? { ...s, assessment: { ...s.assessment, name, updatedAt: nowIso() } }
        : s
    )
  },
  respond(controlId: string, patch: Partial<ControlResponse>) {
    readinessStore.set((s) => {
      if (!s.assessment) return s
      const prev = s.assessment.responses[controlId] ?? { status: "none" }
      return {
        ...s,
        assessment: {
          ...s.assessment,
          responses: {
            ...s.assessment.responses,
            [controlId]: { ...prev, ...patch },
          },
          updatedAt: nowIso(),
        },
      }
    })
  },
  vote(
    controlId: string,
    respondent: string,
    status: ControlResponse["status"]
  ) {
    readinessStore.set((s) => {
      if (!s.assessment || !respondent.trim()) return s
      const prev = s.assessment.responses[controlId] ?? { status: "none" }
      const votes = { ...(prev.votes ?? {}), [respondent]: status }
      const respondents = s.assessment.respondents.includes(respondent)
        ? s.assessment.respondents
        : [...s.assessment.respondents, respondent]
      return {
        ...s,
        assessment: {
          ...s.assessment,
          respondents,
          responses: {
            ...s.assessment.responses,
            [controlId]: { ...prev, votes },
          },
          updatedAt: nowIso(),
        },
      }
    })
  },
  setRespondent(respondent: string) {
    readinessStore.set({ respondent })
  },
  setShowNotApplicable(showNotApplicable: boolean) {
    readinessStore.set({ showNotApplicable })
  },
  snapshot(label: string) {
    readinessStore.set((s) => withSnapshot(s, label))
  },
  addSnapshot(snapshot: Snapshot) {
    readinessStore.set((s) => ({
      ...s,
      snapshots: [
        snapshot,
        ...s.snapshots.filter((x) => x.id !== snapshot.id),
      ].slice(0, 25),
    }))
  },
  deleteSnapshot(id: string) {
    readinessStore.set((s) => ({
      ...s,
      snapshots: s.snapshots.filter((x) => x.id !== id),
    }))
  },
  restoreSnapshot(id: string) {
    readinessStore.set((s) => {
      const snap = s.snapshots.find((x) => x.id === id)
      return snap ? { ...s, assessment: structuredClone(snap.assessment) } : s
    })
  },
  setControlSet(customControlSet: ControlSet | null) {
    readinessStore.set({ customControlSet })
  },
  reset() {
    readinessStore.set({ ...initialState })
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {}
  },
}
