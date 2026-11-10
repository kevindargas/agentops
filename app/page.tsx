import { redirect } from "next/navigation"

/** The product has no marketing landing page; the root always opens the operational overview. */
export default function Home() {
  redirect("/dashboard")
}
