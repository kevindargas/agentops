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

/**
 * Everything lives in the browser (localStorage) — nothing is sent anywhere.
 * `reset()` wipes it.
 */
export const readinessStore = createStore<ReadinessState>(
  {
    assessment: null,
    snapshots: [],
    showNotApplicable: false,
    respondent: "",
    customControlSet: null,
  },
  "agentops.readiness.v1"
)

function nowIso() {
  return new Date().toISOString()
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)
    .toString(36)
    .padStart(3, "0")}`
}

export function createAssessment(
  profile: SystemProfile,
  target: MaturityTarget,
  name = profile.name
): Assessment {
  const ts = nowIso()
  return {
    id: newId("asm"),
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

export const readinessActions = {
  start(profile: SystemProfile, target: MaturityTarget) {
    readinessStore.set({ assessment: createAssessment(profile, target) })
  },
  load(assessment: Assessment) {
    readinessStore.set({ assessment })
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
    readinessStore.set((s) => {
      if (!s.assessment) return s
      const snap: Snapshot = {
        id: newId("snap"),
        label: label.trim() || `Snapshot ${s.snapshots.length + 1}`,
        takenAt: nowIso(),
        assessment: structuredClone(s.assessment),
      }
      return { ...s, snapshots: [snap, ...s.snapshots].slice(0, 25) }
    })
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
    readinessStore.set({
      assessment: null,
      snapshots: [],
      showNotApplicable: false,
      respondent: "",
      customControlSet: null,
    })
    try {
      window.localStorage.removeItem("agentops.readiness.v1")
    } catch {}
  },
}
