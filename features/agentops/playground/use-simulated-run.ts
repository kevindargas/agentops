"use client"

import * as React from "react"

import {
  simulateRun,
  type PlaygroundConfig,
  type PlaygroundResult,
} from "@/lib/data/playground"

export interface SimulatedRunState {
  input: string | null
  result: PlaygroundResult | null
  /** 0–1 stream progress. */
  progress: number
  streaming: boolean
}

const idle: SimulatedRunState = {
  input: null,
  result: null,
  progress: 0,
  streaming: false,
}

/**
 * Plays a scripted `simulateRun` result back as if it were streaming. The
 * result itself is computed synchronously and deterministically; only the
 * reveal is animated, so re-running the same configuration reproduces the
 * same transcript and metrics.
 */
export function useSimulatedRun() {
  const [state, setState] = React.useState<SimulatedRunState>(idle)
  const timer = React.useRef<number | null>(null)

  const clear = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  React.useEffect(() => clear, [clear])

  const start = React.useCallback(
    (config: PlaygroundConfig, input: string) => {
      clear()
      const result = simulateRun(config, input)
      setState({ input, result, progress: 0, streaming: true })
      // Scale playback to the simulated latency but keep it snappy.
      const duration = Math.min(
        4200,
        Math.max(1100, result.metrics.latencyMs * 0.6)
      )
      const startedAt = performance.now()
      timer.current = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - startedAt) / duration)
        setState((s) => ({ ...s, progress: p, streaming: p < 1 }))
        if (p >= 1) clear()
      }, 40)
      return result
    },
    [clear]
  )

  const stop = React.useCallback(() => {
    clear()
    setState((s) => (s.result ? { ...s, progress: 1, streaming: false } : s))
  }, [clear])

  const reset = React.useCallback(() => {
    clear()
    setState(idle)
  }, [clear])

  return { ...state, start, stop, reset }
}
