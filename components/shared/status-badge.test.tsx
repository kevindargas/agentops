import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PriorityBadge, StateBadge } from "@/components/shared/status-badge"

describe("StateBadge", () => {
  it("renders the state text with a tone class", () => {
    render(<StateBadge state="In Progress" />)
    const badge = screen.getByText("In Progress")
    expect(badge.closest("[data-slot]") ?? badge).toBeInTheDocument()
    expect((badge.closest("span") ?? badge).className).toMatch(/brand|progress/)
  })

  it("falls back to a neutral tone for unknown states instead of throwing", () => {
    render(<StateBadge state="Totally New State" />)
    expect(screen.getByText("Totally New State")).toBeInTheDocument()
  })
})

describe("PriorityBadge", () => {
  it("labels priorities", () => {
    render(<PriorityBadge priority={1} />)
    expect(screen.getByText(/P1/)).toBeInTheDocument()
  })
})
