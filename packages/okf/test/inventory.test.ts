import { buildInventory, findNearDuplicates, parseTree } from "../src/index.js"

const concept = (path: string, fm: string) => ({ path, text: `---\n${fm}\n---\n` })

describe("buildInventory", () => {
  const tree = parseTree([
    concept(
      "a.md",
      "type: Customer\ntags: [sales, sales, SaaS]\nstatus: draft\nverified: { by: human:jane, at: 2026-01-01T00:00:00Z }",
    ),
    concept("b.md", "type: Customer\ntags: [saas]\nOwner: jane\nstale_after: 2026-01-01T00:00:00Z"),
    concept(
      "c.md",
      "type: customers\nowner: raj\nverified: [{ by: process:nightly, at: 2026-01-01T00:00:00Z }]",
    ),
    concept("d.md", "title: No type"),
    { path: "index.md", text: "# Index\n" },
  ])
  const inventory = buildInventory(tree, { now: new Date("2026-06-01T00:00:00Z") })

  it("counts types, tags (once per concept), and keys, most used first", () => {
    expect(inventory.concepts).toBe(4)
    expect(inventory.untyped).toBe(1)
    expect(inventory.types).toEqual([
      { value: "Customer", count: 2 },
      { value: "customers", count: 1 },
    ])
    expect(inventory.tags).toEqual([
      { value: "SaaS", count: 1 },
      { value: "saas", count: 1 },
      { value: "sales", count: 1 },
    ])
    expect(inventory.keys[0]).toEqual({ value: "type", count: 3 })
  })

  it("counts statuses, trust tiers, and stale concepts", () => {
    expect(inventory.statuses).toEqual({ draft: 1, stable: 3, deprecated: 0 })
    expect(inventory.trustTiers).toEqual({
      unverified: 2,
      "machine-confirmed": 1,
      "human-reviewed": 1,
    })
    expect(inventory.stale).toBe(1)
  })

  it("groups near-duplicates per field", () => {
    expect(inventory.nearDuplicates).toEqual([
      {
        field: "type",
        values: [
          { value: "Customer", count: 2 },
          { value: "customers", count: 1 },
        ],
        reasons: ["plural"],
      },
      {
        field: "tag",
        values: [
          { value: "SaaS", count: 1 },
          { value: "saas", count: 1 },
        ],
        reasons: ["case-or-punctuation"],
      },
      {
        field: "key",
        values: [
          { value: "Owner", count: 1 },
          { value: "owner", count: 1 },
        ],
        reasons: ["case-or-punctuation"],
      },
    ])
  })

  it("defaults to the current time for staleness", () => {
    expect(buildInventory(tree).stale).toBe(1)
  })
})

describe("findNearDuplicates", () => {
  const values = (...names: string[]) => names.map((value) => ({ value, count: 1 }))
  const groups = (...names: string[]) =>
    findNearDuplicates(values(...names), "tag").map((g) => [
      g.values.map((v) => v.value),
      g.reasons,
    ])

  it("matches case and punctuation variants", () => {
    expect(groups("SaaS Application", "saas-application", "saas_application")).toEqual([
      [["SaaS Application", "saas-application", "saas_application"], ["case-or-punctuation"]],
    ])
  })

  it("matches plurals", () => {
    expect(groups("Policy", "Policies", "Box", "Boxes", "Class", "Classes", "Tag", "Tags")).toEqual(
      [
        [["Policy", "Policies"], ["plural"]],
        [["Box", "Boxes"], ["plural"]],
        [["Class", "Classes"], ["plural"]],
        [["Tag", "Tags"], ["plural"]],
      ],
    )
  })

  it("matches small spelling differences scaled to length", () => {
    expect(groups("colour", "color")).toEqual([[["colour", "color"], ["spelling"]]])
    expect(groups("organisation", "organizatiom")).toEqual([
      [["organisation", "organizatiom"], ["spelling"]],
    ])
    expect(groups("cat", "car")).toEqual([])
    expect(groups("organisation", "orgxnixatixn")).toEqual([])
    expect(groups("abc", "abcdefghijkl")).toEqual([])
  })

  it("never treats containment as a misspelling", () => {
    expect(groups("active-users", "inactive-users")).toEqual([])
  })

  it("records every reason that joined a group", () => {
    expect(groups("Colour", "colour", "colours", "color")).toEqual([
      [
        ["Colour", "colour", "colours", "color"],
        ["case-or-punctuation", "plural", "spelling"],
      ],
    ])
  })

  it("ignores values with no letters or digits", () => {
    expect(groups("--", "__")).toEqual([])
  })
})
