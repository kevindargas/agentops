import { cloneParams, type PlaygroundConfig } from "@/lib/data/playground"
import { createStore } from "@/lib/store"
import type { DeployedAgent } from "@/lib/types"

/**
 * Configurations applied from the Playground in this browser session. The
 * deployed agent records in `lib/data` are immutable, so "Apply to agent"
 * records the new baseline here; the diff, "Reset to deployed" and the share
 * link then compare against what was applied. Not persisted.
 */
export const appliedConfigStore = createStore<{
  byAgent: Record<string, PlaygroundConfig>
}>({ byAgent: {} })

export function deployedConfig(agent: DeployedAgent): PlaygroundConfig {
  return {
    agentId: agent.id,
    promptVersion: agent.promptVersion,
    modelId: agent.modelId,
    params: cloneParams(agent.params),
  }
}

/** Baseline for the diff: the applied configuration, else the deployed one. */
export function useBaseline(agent: DeployedAgent): {
  config: PlaygroundConfig
  applied: boolean
} {
  const applied = appliedConfigStore.use().byAgent[agent.id]
  return applied
    ? { config: applied, applied: true }
    : { config: deployedConfig(agent), applied: false }
}

export function applyConfig(config: PlaygroundConfig) {
  appliedConfigStore.set((s) => ({
    byAgent: {
      ...s.byAgent,
      [config.agentId]: { ...config, params: cloneParams(config.params) },
    },
  }))
}
