import { type Concept, isRecord, isStatus, type KeyPath, visit } from "@okforest/okf"
import type { Report, Rule } from "../types.js"
import { at, describeType, isDatetime, show } from "../util.js"
import { headingText } from "./conformance.js"

/** Run `fn` for each concept with readable frontmatter. */
const eachConcept = (
  concepts: readonly Concept[],
  fn: (concept: Concept, fm: Record<string, unknown>) => void,
) => {
  for (const concept of concepts) if (concept.frontmatter) fn(concept, concept.frontmatter)
}

const reporter =
  (report: (r: Report) => void, concept: Concept) => (path: KeyPath, message: string) =>
    report({ file: concept.path, ...at(concept, path), message })

/** The verification entries as written, with their key paths. */
const verifiedEntries = (value: unknown): { entry: unknown; path: KeyPath }[] =>
  Array.isArray(value)
    ? value.map((entry, i) => ({ entry, path: ["verified", i] }))
    : [{ entry: value, path: ["verified"] }]

export const title: Rule = {
  id: "okf/title",
  severity: "warning",
  description: "Concepts have a `title` (recommended, OKF §4.1).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.title === undefined) {
        report({
          file: concept.path,
          line: 1,
          column: 1,
          message: "No `title`: consumers will fall back to the file name.",
        })
      }
    })
  },
}

export const description: Rule = {
  id: "okf/description",
  severity: "warning",
  description: "Concepts have a one-sentence `description` (recommended, OKF §4.1).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.description === undefined) {
        report({
          file: concept.path,
          line: 1,
          column: 1,
          message: "No `description`: index entries, search snippets, and previews use it.",
        })
      }
    })
  },
}

/** Recommended fields with the wrong shape (OKF §4.1). */
export const fieldTypes: Rule = {
  id: "okf/field-types",
  severity: "warning",
  description:
    "`title`, `description`, and `resource` are strings, and `tags` is a list of strings (OKF §4.1).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      const problem = reporter(report, concept)
      for (const key of ["title", "description", "resource"]) {
        const value = fm[key]
        if (value !== undefined && (typeof value !== "string" || value.trim() === "")) {
          problem([key], `\`${key}\` should be a non-empty string (got ${describeType(value)}).`)
        }
      }
      if (fm.tags !== undefined) {
        if (!Array.isArray(fm.tags)) {
          problem(
            ["tags"],
            `\`tags\` should be a list, e.g. \`tags: [${typeof fm.tags === "string" ? fm.tags : "a, b"}]\`.`,
          )
        } else {
          fm.tags.forEach((tag, i) => {
            if (typeof tag !== "string" || tag.trim() === "") {
              problem(["tags", i], `Each tag should be a non-empty string (got ${show(tag)}).`)
            }
          })
        }
      }
    })
  },
}

export const generated: Rule = {
  id: "okf/generated",
  severity: "error",
  description: "`generated` is a mapping with a required `by` actor (OKF §5.2).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.generated === undefined) return
      const problem = reporter(report, concept)
      if (!isRecord(fm.generated)) {
        problem(
          ["generated"],
          "`generated` must be a mapping: `generated: { by: <actor>, at: <datetime> }`.",
        )
      } else if (typeof fm.generated.by !== "string" || fm.generated.by.trim() === "") {
        problem(
          ["generated"],
          "`generated.by` is required: who or what produced the content (an actor).",
        )
      }
    })
  },
}

export const verified: Rule = {
  id: "okf/verified",
  severity: "error",
  description: "`verified` is a `{ by, at }` mapping or a list of them (OKF §5.2).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.verified === undefined) return
      const problem = reporter(report, concept)
      if (!isRecord(fm.verified) && !Array.isArray(fm.verified)) {
        problem(["verified"], "`verified` must be a `{ by, at }` mapping or a list of them.")
        return
      }
      for (const { entry, path } of verifiedEntries(fm.verified)) {
        if (!isRecord(entry)) {
          problem(path, "Each verification must be a `{ by, at }` mapping.")
          continue
        }
        if (typeof entry.by !== "string" || entry.by.trim() === "") {
          problem(path, "A verification needs `by`: the actor who confirmed the content.")
        }
        if (entry.at === undefined) {
          problem(path, "A verification needs `at`: when the content was confirmed.")
        }
      }
    })
  },
}

export const sources: Rule = {
  id: "okf/sources",
  severity: "error",
  description:
    "`sources` is a list of mappings, each with a `resource`, unique `id`s, and well-formed credibility signals (OKF §5.1).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      const problem = reporter(report, concept)
      checkUsageWindow(fm.usage_window, ["usage_window"], problem)
      if (fm.sources === undefined) return
      if (!Array.isArray(fm.sources)) {
        problem(["sources"], "`sources` must be a list of `{ resource, id, title, ... }` mappings.")
        return
      }
      const ids = new Set<string>()
      fm.sources.forEach((entry, i) => {
        const path = ["sources", i]
        if (!isRecord(entry)) {
          problem(path, "Each source must be a mapping with at least `resource`.")
          return
        }
        if (typeof entry.resource !== "string" || entry.resource.trim() === "") {
          problem(path, "A source needs `resource`: a URL, a bundle path, or a scope descriptor.")
        }
        if (entry.id !== undefined) {
          if (typeof entry.id !== "string" || entry.id.trim() === "") {
            problem(
              [...path, "id"],
              "A source `id` must be a non-empty string (footnotes cite it).",
            )
          } else if (ids.has(entry.id)) {
            problem(
              [...path, "id"],
              `Duplicate source id ${show(entry.id)}: footnotes could not tell them apart.`,
            )
          } else {
            ids.add(entry.id)
          }
        }
        for (const key of ["title", "author"]) {
          if (entry[key] !== undefined && typeof entry[key] !== "string") {
            problem(
              [...path, key],
              `A source \`${key}\` must be a string (got ${describeType(entry[key])}).`,
            )
          }
        }
        const count = entry.usage_count
        if (count !== undefined && !(Number.isInteger(count) && (count as number) >= 0)) {
          problem(
            [...path, "usage_count"],
            `\`usage_count\` must be a whole number of uses (got ${show(count)}).`,
          )
        }
        checkUsageWindow(entry.usage_window, [...path, "usage_window"], problem)
      })
    })
  },
}

function checkUsageWindow(
  value: unknown,
  path: KeyPath,
  problem: (path: KeyPath, message: string) => void,
) {
  if (value === undefined) return
  if (!isRecord(value) || value.from === undefined || value.to === undefined) {
    problem(path, "`usage_window` must be a `{ from, to }` mapping of datetimes.")
  }
}

export const status: Rule = {
  id: "okf/status",
  severity: "error",
  description: "`status` is one of `draft`, `stable`, or `deprecated` (OKF §5.4).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.status === undefined || isStatus(fm.status)) return
      const hint = isStatus(String(fm.status).toLowerCase())
        ? ` (use lowercase \`${String(fm.status).toLowerCase()}\`)`
        : ""
      reporter(report, concept)(
        ["status"],
        `\`status\` must be \`draft\`, \`stable\`, or \`deprecated\`${hint}; got ${show(fm.status)}.`,
      )
    })
  },
}

/** Every timestamp-valued key the spec defines (OKF §5). */
export const datetime: Rule = {
  id: "okf/datetime",
  severity: "error",
  description:
    "Timestamps are ISO 8601 datetimes with an explicit UTC offset, e.g. `2026-06-30T14:00:00Z` (OKF §5).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      const problem = reporter(report, concept)
      const check = (value: unknown, path: KeyPath) => {
        if (value === undefined || isDatetime(value)) return
        const name = keyName(path)
        problem(
          path,
          `\`${name}\` must be an ISO 8601 datetime with an explicit UTC offset, such as ` +
            `\`2026-12-31T00:00:00Z\` (got ${show(value)}).`,
        )
      }
      check(fm.stale_after, ["stale_after"])
      if (isRecord(fm.generated)) check(fm.generated.at, ["generated", "at"])
      if (fm.verified !== undefined) {
        for (const { entry, path } of verifiedEntries(fm.verified)) {
          if (isRecord(entry)) check(entry.at, [...path, "at"])
        }
      }
      const windows: { value: unknown; path: KeyPath }[] = [
        { value: fm.usage_window, path: ["usage_window"] },
      ]
      if (Array.isArray(fm.sources)) {
        fm.sources.forEach((entry, i) => {
          if (!isRecord(entry)) return
          check(entry.last_modified, ["sources", i, "last_modified"])
          windows.push({ value: entry.usage_window, path: ["sources", i, "usage_window"] })
        })
      }
      for (const { value, path } of windows) {
        if (!isRecord(value)) continue
        check(value.from, [...path, "from"])
        check(value.to, [...path, "to"])
      }
    })
  },
}

/** `sources[0].last_modified` */
function keyName(path: KeyPath): string {
  return path.map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? p : `.${p}`)).join("")
}

const ACTOR = /^(?:human:\S+|process:\S+|[^\s:/]+\/\S+)$/

/** OKF §7: `<producer>/<version>`, `human:<id>`, or `process:<id>`. */
export const actor: Rule = {
  id: "okf/actor",
  severity: "warning",
  description:
    "`generated.by` and `verified[].by` follow the actor convention: `<producer>/<version>`, `human:<id>`, or `process:<id>` (OKF §7).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      const problem = reporter(report, concept)
      const check = (value: unknown, path: KeyPath) => {
        if (typeof value !== "string" || value.trim() === "" || ACTOR.test(value)) return
        problem(
          path,
          `${show(value)} is not an actor: use \`human:<id>\` for a person, \`process:<id>\` for an ` +
            "automated process, or `<producer>/<version>` for an agent or tool.",
        )
      }
      if (isRecord(fm.generated)) check(fm.generated.by, ["generated", "by"])
      if (fm.verified !== undefined) {
        for (const { entry, path } of verifiedEntries(fm.verified)) {
          if (isRecord(entry)) check(entry.by, [...path, "by"])
        }
      }
    })
  },
}

/** OKF §10: the Attested Computation contract. */
export const attestedComputation: Rule = {
  id: "okf/attested-computation",
  severity: "error",
  description:
    "An Attested Computation has a `runtime`, well-formed `parameters`, `executor`, and `attester`, and a computation (a `computation` path or a code block under `# Computation`) (OKF §10).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.type !== "Attested Computation") return
      const problem = reporter(report, concept)
      if (typeof fm.runtime !== "string" || fm.runtime.trim() === "") {
        problem(
          fm.runtime === undefined ? ["type"] : ["runtime"],
          "An Attested Computation needs `runtime`, e.g. `runtime: bigquery`.",
        )
      }
      if (fm.parameters !== undefined) {
        if (!Array.isArray(fm.parameters)) {
          problem(
            ["parameters"],
            "`parameters` must be a list of `{ name, type, required }` mappings.",
          )
        } else {
          fm.parameters.forEach((parameter, i) => {
            if (
              !isRecord(parameter) ||
              typeof parameter.name !== "string" ||
              parameter.name.trim() === ""
            ) {
              problem(
                ["parameters", i],
                "Each parameter must be a mapping with a `name`: `{ name, type, required }`.",
              )
            } else if (
              parameter.required !== undefined &&
              typeof parameter.required !== "boolean"
            ) {
              problem(
                ["parameters", i, "required"],
                "A parameter's `required` must be `true` or `false`.",
              )
            }
          })
        }
      }
      for (const key of ["executor", "attester"]) {
        const value = fm[key]
        if (value !== undefined && (!isRecord(value) || typeof value.resource !== "string")) {
          problem([key], `\`${key}\` must be a mapping with a \`resource\` path.`)
        }
      }
      if (fm.computation !== undefined) {
        if (typeof fm.computation !== "string" || fm.computation.trim() === "") {
          problem(
            ["computation"],
            "`computation` must be a path to the file holding the computation.",
          )
        }
      } else if (!hasInlineComputation(concept)) {
        problem(
          ["type"],
          "No computation: add a code block under a `# Computation` heading, or set `computation` to a file path.",
        )
      }
    })
  },
}

function hasInlineComputation(concept: Concept): boolean {
  let depth: number | undefined
  let found = false
  for (const node of concept.ast.children) {
    if (node.type === "heading") {
      if (depth !== undefined && node.depth <= depth) depth = undefined
      if (headingText(node).trim().toLowerCase() === "computation") depth = node.depth
    } else if (depth !== undefined) {
      visit(node, (child) => {
        if (child.type === "code") found = true
      })
    }
  }
  return found
}

/** OKF §13: v0.1 conventions superseded in v0.2. */
export const legacy: Rule = {
  id: "okf/legacy-v01",
  severity: "info",
  description:
    "Flags OKF v0.1 conventions superseded in v0.2: `timestamp` and a body `# Citations` list (OKF §13).",
  check({ tree, report }) {
    eachConcept(tree.concepts, (concept, fm) => {
      if (fm.timestamp !== undefined) {
        reporter(report, concept)(
          ["timestamp"],
          "`timestamp` is OKF v0.1: record the last change as `generated: { by, at }` instead.",
        )
      }
      for (const node of concept.ast.children) {
        if (node.type === "heading" && headingText(node).trim().toLowerCase() === "citations") {
          report({
            file: concept.path,
            line: node.position?.start.line ?? 1,
            column: node.position?.start.column ?? 1,
            message:
              "A `# Citations` list is OKF v0.1: move citations to `sources` and cite them with footnotes.",
          })
        }
      }
    })
  },
}
