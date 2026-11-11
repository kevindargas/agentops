import { RootRedirect } from "./root-redirect"

/**
 * The product has no marketing landing page; the root always opens the
 * operational overview. The redirect runs on the client so the same page
 * works under `next start` and in the static export (see `RootRedirect`).
 */
export default function Home() {
  return <RootRedirect href="/dashboard" />
}
