export const siteConfig = {
  name: "AgentOps",
  tagline: "Operate your AI agent fleet like production software.",
  description:
    "A UI template for running an agentic AI ecosystem: fleet health, traces, drift and quality monitoring, A/B experiments, human review, model recommendations and a semantic layer, with the incident, change and service-health workflows the agents plug into.",
  version: "0.1.0",
  workspace: "Acme Corp",
  /**
   * Public URL of the deployed app. Used for Open Graph metadata; override
   * with NEXT_PUBLIC_SITE_URL when you deploy.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  links: {
    /**
     * Repo-relative path to the documentation folder. There is no in-app docs
     * route; point this at your hosted docs once you have them.
     */
    docs: "docs/README.md",
  },
  /** Locale, currency and time zone used by every formatter in lib/format.ts. */
  locale: "en-US",
  currency: "USD",
  timeZone: "UTC",
  /**
   * Global keyboard shortcuts. Each entry is the key sequence as displayed in
   * tooltips and the command menu. The handlers live in
   * components/layout/command-menu.tsx (Cmd K, chords, C, D, Cmd ,), the
   * sidebar provider (Cmd B) and the AI provider (Cmd J).
   */
  shortcuts: {
    commandMenu: ["⌘", "K"],
    assistant: ["⌘", "J"],
    sidebar: ["⌘", "B"],
    settings: ["⌘", ","],
    quickCreate: ["C"],
    darkMode: ["D"],
    /** Prefix key for "go to" chords, e.g. G then D for the dashboard. */
    goTo: "G",
  },
} as const
