import { createColumnHelper } from "@tanstack/react-table"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  DataTable,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"

interface Row {
  id: string
  name: string
  tags: string[]
}

const col = createColumnHelper<DataTableFeatures, Row>()
const columns = col.columns([
  col.accessor("name", { header: "Name", cell: ({ getValue }) => getValue() }),
  col.accessor("tags", {
    header: "Tags",
    cell: ({ getValue }) => getValue().join(", "),
    enableSorting: false,
  }),
])

const data: Row[] = [
  { id: "1", name: "Alpha", tags: ["tools", "vision"] },
  { id: "2", name: "Beta", tags: ["tools"] },
  { id: "3", name: "Gamma", tags: [] },
]

const facets: FacetDef<Row>[] = [
  {
    id: "tag",
    title: "Tag",
    options: [
      { value: "tools", label: "Tools" },
      { value: "vision", label: "Vision" },
    ],
    getValue: (r) => r.tags,
  },
]

describe("DataTable", () => {
  it("renders rows and the total label", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        totalLabel="rows"
        hideToolbar
      />
    )
    const body = screen.getAllByRole("rowgroup")[1]
    expect(within(body).getAllByRole("row")).toHaveLength(3)
  })

  it("filters by search text", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        getSearchText={(r) => r.name}
        searchPlaceholder="Search…"
      />
    )
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "bet" },
    })
    const body = screen.getAllByRole("rowgroup")[1]
    expect(within(body).getAllByRole("row")).toHaveLength(1)
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("accepts multi-valued facets", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        facets={facets}
        initialFacets={{ tag: ["vision"] }}
      />
    )
    const body = screen.getAllByRole("rowgroup")[1]
    expect(within(body).getAllByRole("row")).toHaveLength(1)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("shows an empty state when nothing matches", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        emptyTitle="No rows"
        hideToolbar
      />
    )
    expect(screen.getByText("No rows")).toBeInTheDocument()
  })
})
