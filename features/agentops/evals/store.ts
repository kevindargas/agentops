import {
  evalDatasets,
  releaseGates,
  type DatasetVersion,
  type EvalDataset,
} from "@/lib/data/evals"
import { clock } from "@/lib/data/seed"
import { createListStore } from "@/lib/store"

/**
 * Client lists for the parts of the evals page the user can change: dataset
 * versions (cases added from the review queue or the case sheet) and release
 * gate enforcement. Runs and evaluators are read-only in the template.
 */
export const datasetStore = createListStore(evalDatasets, (d) => d.id)
export const gateStore = createListStore(releaseGates, (g) => g.id)

/** "v12" to "v13"; falls back to appending ".1" for non-numeric versions. */
export function bumpVersion(version: string) {
  const m = version.match(/^(.*?)(\d+)$/)
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${version}.1`
}

const SESSION_NOTE = "Session draft: "

/**
 * Add `n` cases to a dataset as a draft version created in this session. The
 * first addition opens a new version; later additions grow the same draft so
 * the Versions list does not fill with one-case entries.
 */
export function addCasesToDataset(datasetId: string, n: number, note: string) {
  let result: EvalDataset | undefined
  datasetStore.patch(datasetId, (d) => {
    const now = clock().toISOString()
    const cases = d.cases + n
    const [head, ...rest] = d.versions
    const sessionDraft = head && head.note.startsWith(SESSION_NOTE)
    const version: DatasetVersion = sessionDraft
      ? {
          ...head,
          cases,
          date: now,
          note: `${head.note}; ${note}`,
        }
      : {
          version: bumpVersion(d.version),
          date: now,
          cases,
          note: `${SESSION_NOTE}${note}`,
        }
    result = {
      ...d,
      cases,
      version: version.version,
      updated: now,
      sizeTrend: [...d.sizeTrend.slice(1), cases],
      versions: sessionDraft ? [version, ...rest] : [version, ...d.versions],
    }
    return result
  })
  return result
}
