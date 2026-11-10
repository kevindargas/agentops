"use client"

import { cn } from "cn"
import { BotIcon, SparklesIcon } from "lucide-react"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { PlaygroundResult } from "@/lib/data/playground"

/**
 * How far a simulated stream has progressed. Produced by `useSimulatedRun`;
 * the transcript only renders what the progress allows.
 */
export interface StreamProgress {
  /** 0 to 1 overall; 1 means complete. */
  value: number
  streaming: boolean
}

/** Phase boundaries of the simulated stream (fractions of total progress). */
export const PHASES = { reasoning: 0.22, tools: 0.55 } as const

export function visibleTranscript(result: PlaygroundResult, p: number) {
  const hasReasoning = result.reasoning.length > 0
  const reasoningEnd = hasReasoning ? PHASES.reasoning : 0
  const toolsEnd = result.tools.length ? PHASES.tools : reasoningEnd
  const reasoningFrac = hasReasoning ? Math.min(1, p / PHASES.reasoning) : 1
  const reasoningChars = Math.floor(result.reasoning.length * reasoningFrac)

  const toolSpan = toolsEnd - reasoningEnd
  const toolsFrac =
    toolSpan > 0 ? Math.min(1, Math.max(0, (p - reasoningEnd) / toolSpan)) : 1
  // Each tool goes through input (first half) then output (second half).
  const toolSteps = result.tools.length * 2
  const toolStepsDone = Math.floor(toolsFrac * toolSteps + 1e-6)

  const answerSpan = 1 - toolsEnd
  const answerFrac = Math.min(1, Math.max(0, (p - toolsEnd) / answerSpan))
  const answerChars = Math.floor(result.answer.length * answerFrac)

  return {
    reasoning: result.reasoning.slice(0, reasoningChars),
    reasoningDone: reasoningFrac >= 1,
    tools: result.tools.map((t, i) => {
      const step = toolStepsDone - i * 2
      return {
        ...t,
        state:
          step >= 2
            ? ("output-available" as const)
            : step >= 1
              ? ("input-available" as const)
              : null,
      }
    }),
    answer: result.answer.slice(0, answerChars),
    answerStarted: p > toolsEnd,
  }
}

export function RunTranscript({
  input,
  result,
  progress,
  agentName,
  className,
}: {
  input: string | null
  result: PlaygroundResult | null
  progress: StreamProgress
  agentName: string
  className?: string
}) {
  if (!result || input === null) {
    return (
      <div className={cn("flex min-h-64 flex-col", className)}>
        <ConversationEmptyState
          icon={<SparklesIcon className="size-6" />}
          title="No run yet"
          description="Fill in the prompt and variables, then press Run. The transcript, tool calls and metrics appear here."
          className="flex-1 rounded-xl border border-dashed"
        />
      </div>
    )
  }

  const v = visibleTranscript(result, progress.value)
  const streaming = progress.streaming

  return (
    <Conversation className={cn("min-h-64", className)}>
      <ConversationContent className="gap-5 px-0 py-0">
        <Message from="user" className="max-w-[85%]">
          <MessageContent className="group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:px-3.5 group-[.is-user]:py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {input}
            </p>
          </MessageContent>
        </Message>

        <Message from="assistant" className="max-w-full gap-1.5">
          <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
            <span className="flex size-4 items-center justify-center rounded-sm bg-brand/10 text-brand">
              <BotIcon
                className={cn("size-2.5", streaming && "animate-pulse")}
              />
            </span>
            {agentName}
          </div>
          <MessageContent className="w-full gap-3 bg-transparent px-0 py-0">
            {progress.value === 0 && streaming && (
              <Shimmer className="text-sm">Thinking</Shimmer>
            )}
            {(v.reasoning.length > 0 || (result.reasoning && streaming)) && (
              <Reasoning
                isStreaming={streaming && !v.reasoningDone}
                defaultOpen={false}
                className="w-full text-xs"
              >
                <ReasoningTrigger className="text-xs [&_svg]:size-3.5" />
                <ReasoningContent className="mt-2 rounded-md border-l-2 border-brand/30 pl-3 text-xs leading-relaxed">
                  {v.reasoning}
                </ReasoningContent>
              </Reasoning>
            )}
            {v.tools.some((t) => t.state) && (
              <div className="flex flex-col gap-1.5">
                {v.tools.map((t) =>
                  t.state ? (
                    <Tool
                      key={t.name}
                      defaultOpen={false}
                      className="mb-0 rounded-lg bg-card"
                    >
                      <ToolHeader
                        type={`tool-${t.name}`}
                        state={t.state}
                        title={t.title}
                        className="px-3 py-2 **:data-[slot=badge]:h-5 **:data-[slot=badge]:text-3xs [&>div>span]:text-xs"
                      />
                      <ToolContent className="space-y-3 border-t p-3 **:[pre]:text-2xs">
                        <ToolInput input={t.input} />
                        <ToolOutput
                          output={
                            t.state === "output-available"
                              ? t.output
                              : undefined
                          }
                          errorText={undefined}
                        />
                      </ToolContent>
                    </Tool>
                  ) : null
                )}
              </div>
            )}
            {v.answerStarted && v.answer.length > 0 && (
              <MessageResponse className="text-sm leading-relaxed [&_table]:text-xs [&_th]:font-medium">
                {v.answer}
              </MessageResponse>
            )}
          </MessageContent>
        </Message>
      </ConversationContent>
    </Conversation>
  )
}
