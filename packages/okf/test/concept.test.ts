import {
  deriveStatus,
  deriveTrustTier,
  isStaleAt,
  isStatus,
  normalizeSources,
  normalizeVerified,
  parseTree,
} from "../src/index.js"

const conceptOf = (frontmatter: string) => {
  const c = parseTree([{ path: "c.md", text: `---\n${frontmatter}\n---\n` }]).concepts[0]
  if (!c) throw new Error("no concept")
  return c
}

describe("concept fields", () => {
  it("derives every field from the spec's families", () => {
    const c = conceptOf(
      [
        "type: Attested Computation",
        "title: Revenue",
        "description: Recognized revenue.",
        "resource: https://acme.example/revenue",
        "tags: [finance, revenue, 3]",
        "status: deprecated",
        "generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-20T22:53:05Z }",
        "verified: { by: human:jane, at: 2026-06-25T09:00:00Z }",
        "stale_after: 2026-09-23T00:00:00Z",
        "sources:",
        "  - { id: s1, resource: https://acme.example/s1, title: S1, author: team:fin, usage_count: 5, last_modified: 2026-05-30T00:00:00Z }",
      ].join("\n"),
    )
    expect(c).toMatchObject({
      kind: "concept",
      id: "c",
      type: "Attested Computation",
      title: "Revenue",
      description: "Recognized revenue.",
      resource: "https://acme.example/revenue",
      tags: ["finance", "revenue"],
      status: "deprecated",
      generated: { by: "reference_agent/gemini-2.5-pro", at: "2026-06-20T22:53:05Z" },
      verified: [{ by: "human:jane", at: "2026-06-25T09:00:00Z" }],
      trustTier: "human-reviewed",
      staleAfter: "2026-09-23T00:00:00Z",
      sources: [
        {
          id: "s1",
          resource: "https://acme.example/s1",
          title: "S1",
          author: "team:fin",
          usageCount: 5,
          lastModified: "2026-05-30T00:00:00Z",
        },
      ],
    })
    expect(c.isStale(new Date("2026-09-23T00:00:00Z"))).toBe(true)
    expect(c.isStale(new Date("2026-09-22T23:59:59Z"))).toBe(false)
  })

  it("defaults: stable, unverified, no tags, never stale", () => {
    const c = conceptOf("type: Note\ntitle: '  '\ngenerated: not-a-mapping\ntags: solo")
    expect(c.status).toBe("stable")
    expect(c.trustTier).toBe("unverified")
    expect(c.title).toBeUndefined()
    expect(c.generated).toBeUndefined()
    expect(c.tags).toEqual(["solo"])
    expect(c.isStale()).toBe(false)
    expect(conceptOf("type: Note\ntags: { a: b }").tags).toEqual([])
    expect(conceptOf("type: Note\ngenerated: { by: 3 }").generated).toEqual({})
  })

  it("survives unreadable frontmatter", () => {
    const c = parseTree([{ path: "broken.md", text: "---\ntype: [\n---\n" }]).concepts[0]
    expect(c).toMatchObject({ id: "broken", status: "stable", trustTier: "unverified", tags: [] })
    expect(c?.type).toBeUndefined()
  })
})

describe("trust and lifecycle helpers", () => {
  it("treats a bare verified mapping as a one-element list", () => {
    expect(normalizeVerified({ by: "human:a", at: "2026-01-01T00:00:00Z" })).toEqual([
      { by: "human:a", at: "2026-01-01T00:00:00Z" },
    ])
    expect(normalizeVerified([{ by: "process:nightly" }, { by: "" }, "x", { at: "t" }])).toEqual([
      { by: "process:nightly" },
    ])
    expect(normalizeVerified(undefined)).toEqual([])
  })

  it("derives trust tiers from verifiers", () => {
    expect(deriveTrustTier([])).toBe("unverified")
    expect(deriveTrustTier([{ by: "process:nightly" }])).toBe("machine-confirmed")
    expect(deriveTrustTier([{ by: "process:nightly" }, { by: "human:jane" }])).toBe(
      "human-reviewed",
    )
  })

  it("derives status, treating absent and unknown values as stable", () => {
    expect(deriveStatus("draft")).toBe("draft")
    expect(deriveStatus(undefined)).toBe("stable")
    expect(deriveStatus("published")).toBe("stable")
    expect(isStatus("deprecated")).toBe(true)
    expect(isStatus("Draft")).toBe(false)
  })

  it("compares staleness as an instant", () => {
    const now = new Date("2026-10-01T00:00:00Z")
    expect(isStaleAt("2026-09-23T00:00:00Z", now)).toBe(true)
    expect(isStaleAt("2026-10-01T00:00:00+01:00", now)).toBe(true)
    expect(isStaleAt("2027-01-01T00:00:00Z", now)).toBe(false)
    expect(isStaleAt("someday", now)).toBe(false)
    expect(isStaleAt(undefined, now)).toBe(false)
  })

  it("keeps only well-typed source fields", () => {
    expect(normalizeSources([{ resource: 5, id: "x", usage_count: "many" }, "bare"])).toEqual([
      { id: "x" },
    ])
    expect(normalizeSources("nope")).toEqual([])
  })
})
