export function normalizeBasePath(basePath: string): string
export function resolveRequest(
  urlPath: string,
  options: { root: string; basePath?: string }
):
  | { kind: "file"; path: string; status: number }
  | { kind: "redirect"; location: string }
  | { kind: "notFound"; path: string }
export function startServer(options: {
  root: string
  basePath: string
  port: number
}): import("node:http").Server
