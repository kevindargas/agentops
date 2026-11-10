import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep the repo free of generated agent-rules files.
  agentRules: false,
}

export default nextConfig
