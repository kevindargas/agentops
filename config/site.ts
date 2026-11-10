export const siteConfig = {
  name: "AgentOps",
  tagline: "Operate your AI agent fleet like production software.",
  description:
    "A UI template for running an agentic AI ecosystem — fleet health, traces, drift and quality monitoring, A/B experiments, human review, model recommendations and a semantic layer — with the incident, change and service-health workflows the agents plug into.",
  version: "0.1.0",
  workspace: "Acme Corp",
  links: {
    github: "https://github.com",
    docs: "/docs",
  },
  /**
   * Global keyboard shortcuts. Each entry is the key sequence as displayed in
   * tooltips and the command menu. The handlers live in the layout components
   * (command-menu for ⌘K / chords, sidebar provider for ⌘B, AI provider for ⌘J).
   */
  shortcuts: {
    commandMenu: ["⌘", "K"],
    assistant: ["⌘", "J"],
    sidebar: ["⌘", "B"],
    quickCreate: ["C"],
    /** Prefix key for "go to" chords, e.g. G then D for the dashboard. */
    goTo: "G",
  },
} as const
