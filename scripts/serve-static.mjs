/**
 * Serves the static export in `out/` the way GitHub Pages does: under the
 * base path, with `index.html` for directory URLs, a redirect from
 * `/dashboard` to `/dashboard/` and `404.html` for anything unknown.
 *
 *   pnpm build:static && pnpm preview:static
 *   NEXT_PUBLIC_BASE_PATH=/agentops pnpm preview:static   # http://localhost:4173/agentops/
 *
 * Honours `NEXT_PUBLIC_BASE_PATH` (default ""), `PORT` (default 4173) and
 * `STATIC_DIR` (default `out`). Only used for local previews; the real site
 * is served by GitHub Pages.
 */
import { createServer } from "node:http"
import { existsSync, statSync, createReadStream } from "node:fs"
import { extname, join, normalize, resolve, sep } from "node:path"

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
}

/** Strip a trailing slash so "/agentops/" and "/agentops" compare equal. */
export function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") return ""
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
}

/**
 * Decide what to do with a request path. Pure so it can be unit tested.
 *
 * Returns one of
 *   { kind: "file", path, status }     serve this file from the export
 *   { kind: "redirect", location }     send a 301 to a directory URL
 *   { kind: "notFound", path }         serve 404.html with a 404 status
 */
export function resolveRequest(urlPath, { root, basePath = "" }) {
  const base = normalizeBasePath(basePath)
  const pathname = decodeURIComponent(urlPath.split("?")[0])

  // Outside the base path there is nothing to serve, except that the bare
  // domain root points at the site like a Pages user would expect.
  if (base && !(pathname === base || pathname.startsWith(`${base}/`))) {
    if (pathname === "/") return { kind: "redirect", location: `${base}/` }
    return { kind: "notFound", path: join(root, "404.html") }
  }
  if (base && pathname === base)
    return { kind: "redirect", location: `${base}/` }

  const relative = base ? pathname.slice(base.length) : pathname
  const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "")
  const target = resolve(root, `.${safe}`)
  if (!target.startsWith(resolve(root) + sep) && target !== resolve(root)) {
    return { kind: "notFound", path: join(root, "404.html") }
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!pathname.endsWith("/"))
      return { kind: "redirect", location: `${pathname}/` }
    const index = join(target, "index.html")
    if (existsSync(index)) return { kind: "file", path: index, status: 200 }
    return { kind: "notFound", path: join(root, "404.html") }
  }
  if (existsSync(target) && statSync(target).isFile())
    return { kind: "file", path: target, status: 200 }
  if (existsSync(`${target}.html`))
    return { kind: "file", path: `${target}.html`, status: 200 }
  return { kind: "notFound", path: join(root, "404.html") }
}

export function startServer({ root, basePath, port }) {
  const server = createServer((req, res) => {
    const result = resolveRequest(req.url ?? "/", { root, basePath })
    if (result.kind === "redirect") {
      res.writeHead(301, { location: result.location })
      res.end()
      return
    }
    const status = result.kind === "notFound" ? 404 : result.status
    if (!existsSync(result.path)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
      res.end("Not found")
      return
    }
    res.writeHead(status, {
      "content-type": MIME[extname(result.path)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    })
    createReadStream(result.path).pipe(res)
  })
  server.listen(port)
  return server
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)
if (isMain) {
  const root = resolve(process.env.STATIC_DIR ?? "out")
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  const port = Number(process.env.PORT ?? 4173)
  if (!existsSync(join(root, "index.html"))) {
    console.error(
      `No static export in ${root}. Run \`pnpm build:static\` first.`
    )
    process.exit(1)
  }
  startServer({ root, basePath, port })
  console.log(`Serving ${root} at http://localhost:${port}${basePath}/`)
}
