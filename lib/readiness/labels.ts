import type {
  Applicability,
  AutonomyLevel,
  CadenceInterval,
  ControlStatus,
  DataSensitivity,
  Effort,
  MaturityLevel,
  MaturityTarget,
  RegulatoryScope,
  SystemType,
  UserExposure,
} from "./types"

export const statusLabel: Record<ControlStatus, string> = {
  none: "Not started",
  planned: "Planned",
  partial: "Partial",
  "in-place": "In place",
  verified: "Verified",
}

export const statusHint: Record<ControlStatus, string> = {
  none: "Nothing exists yet.",
  planned: "Owner and plan agreed, not built.",
  partial: "Exists for some agents, paths or environments.",
  "in-place": "Implemented everywhere it applies.",
  verified: "Implemented and the 'done looks like' test passed with evidence.",
}

export const systemTypeLabel: Record<SystemType, string> = {
  chatbot: "Chatbot",
  rag: "RAG assistant",
  agent: "Single agent",
  "multi-agent": "Multi-agent system",
}

export const systemTypeHint: Record<SystemType, string> = {
  chatbot: "Conversational model with no retrieval or tools.",
  rag: "Answers grounded in a knowledge base; no side-effecting tools.",
  agent: "Plans and calls tools or APIs to complete tasks.",
  "multi-agent": "Several agents hand off work to each other.",
}

export const autonomyLabel: Record<AutonomyLevel, string> = {
  assist: "Assist: suggests only",
  supervised: "Supervised: acts with approval",
  autonomous: "Autonomous: acts without approval",
}

export const sensitivityLabel: Record<DataSensitivity, string> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  regulated: "Regulated (PII, PHI, PCI)",
}

export const exposureLabel: Record<UserExposure, string> = {
  internal: "Internal users",
  external: "External users / customers",
}

export const regulatoryLabel: Record<RegulatoryScope, string> = {
  "eu-ai-act": "EU AI Act",
  gdpr: "GDPR",
  hipaa: "HIPAA",
  "pci-dss": "PCI DSS",
  soc2: "SOC 2",
  "iso-42001": "ISO/IEC 42001",
}

export const maturityTargetLabel: Record<MaturityTarget, string> = {
  prototype: "Prototype",
  pilot: "Pilot",
  production: "Production",
}

export const maturityTargetHint: Record<MaturityTarget, string> = {
  prototype:
    "Internal demo or experiment. Tracing, a dataset and the hard safety bounds.",
  pilot:
    "Limited real users. Adds evals in CI, guardrails, budgets, documentation.",
  production:
    "General availability. Adds drift monitoring, red-teaming, incident process.",
}

export const maturityLevelLabel: Record<MaturityLevel, string> = {
  "ad-hoc": "Ad hoc",
  defined: "Defined",
  managed: "Managed",
  optimized: "Optimized",
}

export const maturityLevelHint: Record<MaturityLevel, string> = {
  "ad-hoc": "Controls depend on individuals. Score below 40.",
  defined: "Controls are planned and partially built. Score 40 to 64.",
  managed: "Controls are in place and measured. Score 65 to 84.",
  optimized:
    "Score 85+ and at least half of required controls verified with evidence.",
}

export const effortLabel: Record<Effort, string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
}

export const applicabilityLabel: Record<Applicability, string> = {
  applies: "Applies",
  reduced: "Down-weighted",
  "not-applicable": "Not applicable",
}

export const cadenceLabel: Record<CadenceInterval, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Every 6 months",
}
