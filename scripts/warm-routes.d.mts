export const SAMPLE_IDS: Record<string, string>
export function collectRoutes(appDir: string): {
  staticRoutes: string[]
  dynamicRoutes: string[]
  skipped: string[]
}
export function warmRoutes(appDir: string): string[]
