import {
  type Finding,
  ruleUrl,
  toReport,
  type ValidationResult,
  validate,
} from "@okforest/validate"
import { formatOption, parseCommand } from "../args.js"
import { EXIT, type Io, paint, VERSION } from "../io.js"
import { loadTree } from "../tree.js"

const HELP = `Usage: okforest validate [path] [--format text|json]

Check the OKF v0.2 tree at path (default: the current directory) against the
OKF specification and OKForest conventions. Exits 1 when there are errors;
warnings and info are reported but never fail.

Options
  --format text|json   Output format (default: text). JSON is for CI and tools.
`

export async function validateCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, path } = parseCommand(args, { format: { type: "string" } })
  if (values.help) {
    io.stdout(HELP)
    return EXIT.ok
  }
  const format = formatOption(values.format)
  const result = await validate(await loadTree(path, io))
  io.stdout(format === "json" ? toJson(path, result) : toText(result, io))
  return result.ok ? EXIT.ok : EXIT.failed
}

/** The shared validation report (`@okforest/validate`'s `toReport`), as JSON. */
export function toJson(path: string, result: ValidationResult): string {
  return `${JSON.stringify(toReport(result, { tool: { name: "okforest", version: VERSION }, path }), null, 2)}\n`
}

const LABEL = { error: "error", warning: "warning", info: "info" } as const
const COLOR = { error: "red", warning: "yellow", info: "cyan" } as const

export function toText(result: ValidationResult, io: Io): string {
  const out: string[] = []
  const byFile = new Map<string, Finding[]>()
  for (const finding of result.findings) {
    byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding])
  }
  for (const [file, findings] of byFile) {
    out.push(paint(io, "underline", file))
    const positions = findings.map((f) =>
      f.line === undefined ? "" : `${f.line}:${f.column ?? 1}`,
    )
    const width = Math.max(...positions.map((p) => p.length))
    findings.forEach((f, i) => {
      out.push(
        `  ${paint(io, "dim", (positions[i] as string).padEnd(width))}  ` +
          `${paint(io, COLOR[f.severity], LABEL[f.severity].padEnd(7))}  ${f.message}  ${paint(io, "dim", f.ruleId)}`,
      )
    })
    out.push("")
  }
  out.push(...ruleDocs(result.findings, io))
  out.push(summary(result, io))
  return `${out.join("\n")}\n`
}

/** Each rule that reported something, with its documentation page. */
function ruleDocs(findings: readonly Finding[], io: Io): string[] {
  const ids = [...new Set(findings.map((f) => f.ruleId))]
  if (ids.length === 0) return []
  const width = Math.max(...ids.map((id) => id.length))
  return [
    paint(io, "underline", "Rule docs"),
    ...ids.map((id) => `  ${id.padEnd(width)}  ${paint(io, "dim", ruleUrl(id))}`),
    `  ${paint(io, "dim", "Run `okforest rule <rule>` for why and how to fix.")}`,
    "",
  ]
}

function summary(result: ValidationResult, io: Io): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
  const scope = `${plural(result.concepts, "concept")} in ${plural(result.files, "file")}`
  if (result.findings.length === 0) return `${paint(io, "green", "✔")} No problems · ${scope}`
  const counts = `${plural(result.errors, "error")}, ${plural(result.warnings, "warning")}, ${result.infos} info`
  return result.ok
    ? `${paint(io, "green", "✔")} ${counts} · ${scope}`
    : `${paint(io, "red", "✖")} ${counts} · ${scope}`
}
