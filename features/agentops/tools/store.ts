import { mcpServers, tools, type McpServer, type Tool } from "@/lib/data/tools"
import { createListStore } from "@/lib/store"

/**
 * Module-scoped client stores for Tools & MCP. The tab counts, stat cards,
 * tables, cards and sheets read the same lists so a disabled tool or a revoked
 * server moves every number on the page. Not persisted.
 */
export const toolStore = createListStore<Tool>(tools, (t) => t.name)
export const serverStore = createListStore<McpServer>(mcpServers, (s) => s.id)
