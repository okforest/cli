import {
  currentVerifications,
  deriveStatus,
  deriveTrustTier,
  isStaleAt,
  isStatus,
  normalizeSources,
  normalizeVerified,
  okfVersionAtLeast,
  parseOkfVersion,
  parseTimestamp,
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

  it("keeps a status OKF doesn't define as written, and superseded_by", () => {
    const c = conceptOf("type: Metric\nstatus: retired\nsuperseded_by: /metrics/margin.md")
    expect(c).toMatchObject({ status: "unrecognized", statusValue: "retired" })
    expect(c.supersededBy).toBe("/metrics/margin.md")
  })

  it("keeps verifications from before the last change as history (OKF §5.3)", () => {
    const c = conceptOf(
      [
        "type: Metric",
        "generated: { by: agent/1, at: 2026-06-20T00:00:00Z }",
        "verified:",
        "  - { by: human:jane, at: 2026-06-01T00:00:00Z }",
        "  - { by: process:nightly, at: 2026-06-21T00:00:00Z }",
      ].join("\n"),
    )
    expect(c.trustTier).toBe("machine-confirmed")
    expect(c.verifiedBefore).toEqual([{ by: "human:jane", at: "2026-06-01T00:00:00Z" }])
  })

  it("reads one tag as a list of one, never split at commas (OKF §11.2)", () => {
    expect(conceptOf("type: Note\ntags: sales, revenue").tags).toEqual(["sales, revenue"])
    expect(conceptOf("type: Note\ntags: ''").tags).toEqual([])
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

  it("derives trust tiers from current verifiers only (OKF §5.3)", () => {
    const at = "2026-06-25T09:00:00Z"
    expect(deriveTrustTier([])).toBe("unverified")
    expect(deriveTrustTier([{ by: "process:nightly", at }])).toBe("machine-confirmed")
    expect(
      deriveTrustTier([
        { by: "process:nightly", at },
        { by: "human:jane", at },
      ]),
    ).toBe("human-reviewed")
    // A team isn't a person; an event without a time doesn't count (§5.2, §7).
    expect(deriveTrustTier([{ by: "team:fpa", at }])).toBe("machine-confirmed")
    expect(deriveTrustTier([{ by: "human:jane" }])).toBe("unverified")
    // Rewritten after the review: no longer human-reviewed.
    expect(deriveTrustTier([{ by: "human:jane", at }], "2026-06-26T00:00:00Z")).toBe("unverified")
    expect(deriveTrustTier([{ by: "human:jane", at }], "2026-06-25T09:00:00Z")).toBe(
      "human-reviewed",
    )
    expect(
      currentVerifications(
        [
          { by: "human:jane", at: "2026-06-01" },
          { by: "process:nightly", at: "2026-07-01" },
        ],
        "2026-06-20T00:00:00Z",
      ),
    ).toEqual([{ by: "process:nightly", at: "2026-07-01" }])
  })

  it("derives status: absent is stable, a value OKF doesn't define isn't (OKF §5.4)", () => {
    expect(deriveStatus("draft")).toBe("draft")
    expect(deriveStatus(undefined)).toBe("stable")
    expect(deriveStatus(null)).toBe("stable")
    expect(deriveStatus("")).toBe("stable")
    expect(deriveStatus("published")).toBe("unrecognized")
    expect(deriveStatus("Draft")).toBe("unrecognized")
    expect(isStatus("deprecated")).toBe(true)
    expect(isStatus("Draft")).toBe(false)
  })

  it("compares staleness as an instant; a malformed stale_after is never fresh (OKF §5.5)", () => {
    const now = new Date("2026-10-01T00:00:00Z")
    expect(isStaleAt("2026-09-23T00:00:00Z", now)).toBe(true)
    expect(isStaleAt("2026-10-01T00:00:00+01:00", now)).toBe(true)
    expect(isStaleAt("2027-01-01T00:00:00Z", now)).toBe(false)
    expect(isStaleAt("2026-10-01", now)).toBe(true)
    expect(isStaleAt("2026-10-02", now)).toBe(false)
    expect(isStaleAt("someday", now)).toBe(true)
    expect(isStaleAt("2026-10-02T00:00:00", now)).toBe(true)
    expect(isStaleAt(undefined, now)).toBe(false)
    expect(isStaleAt(null, now)).toBe(false)
    expect(isStaleAt("", now)).toBe(false)
  })

  it("reads timestamps as OKF writes them: a date-time with an offset, or a date (OKF §5)", () => {
    expect(parseTimestamp("2026-06-30")).toBe(Date.UTC(2026, 5, 30))
    expect(parseTimestamp("2026-06-30T14:00:00Z")).toBe(Date.UTC(2026, 5, 30, 14))
    expect(parseTimestamp("2026-06-30T14:00:00.5+02:00")).toBe(Date.UTC(2026, 5, 30, 12, 0, 0, 500))
    for (const bad of [
      "2026-06-30T14:00:00",
      "2026-02-30",
      "June 30, 2026",
      "2026-6-30",
      20260630,
    ]) {
      expect(parseTimestamp(bad), String(bad)).toBeUndefined()
    }
  })

  it("reads the OKF version a bundle declares", () => {
    expect(parseOkfVersion("0.3")).toEqual({ major: 0, minor: 3 })
    expect(parseOkfVersion(0.2)).toEqual({ major: 0, minor: 2 })
    expect(parseOkfVersion("v0.3")).toBeUndefined()
    expect(okfVersionAtLeast("0.3", "0.3")).toBe(true)
    expect(okfVersionAtLeast("1.0", "0.3")).toBe(true)
    expect(okfVersionAtLeast("0.2", "0.3")).toBe(false)
    expect(okfVersionAtLeast(undefined, "0.3")).toBe(false)
  })

  it("keeps only well-typed source fields", () => {
    expect(normalizeSources([{ resource: 5, id: "x", usage_count: "many" }, "bare"])).toEqual([
      { id: "x" },
    ])
    expect(normalizeSources("nope")).toEqual([])
    // One entry is a list of one (§11.2).
    expect(normalizeSources({ resource: "https://acme.example/s" })).toEqual([
      { resource: "https://acme.example/s" },
    ])
  })
})
