import { buildInventory, type Count, type Inventory } from "@okforest/okf"
import { formatOption, parseCommand } from "../args.js"
import { EXIT, type Io, paint, VERSION } from "../io.js"
import { loadTree } from "../tree.js"

const HELP = `Usage: okforest inventory [path] [--format text|json]

List every type, tag, and frontmatter key in use in the tree at path (default:
the current directory), with counts, lifecycle and trust totals, and likely
near-duplicates (case, punctuation, plurals, and small spelling differences).

Options
  --format text|json   Output format (default: text).
`

export async function inventoryCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, path } = parseCommand(args, { format: { type: "string" } })
  if (values.help) {
    io.stdout(HELP)
    return EXIT.ok
  }
  const format = formatOption(values.format)
  const inventory = buildInventory(await loadTree(path, io))
  io.stdout(
    format === "json"
      ? `${JSON.stringify({ schemaVersion: 1, tool: { name: "okforest", version: VERSION }, path, ...inventory }, null, 2)}\n`
      : inventoryText(inventory, io),
  )
  return EXIT.ok
}

const REASONS = {
  "case-or-punctuation": "case or punctuation",
  plural: "singular and plural",
  spelling: "spelling",
} as const

export function inventoryText(inventory: Inventory, io: Io): string {
  const out: string[] = []
  const { statuses: s, trustTiers: t } = inventory
  out.push(
    `${inventory.concepts} concepts · ${inventory.types.length} types · ${inventory.tags.length} tags · ` +
      `${inventory.keys.length} frontmatter keys`,
    `Status: ${s.stable} stable, ${s.draft} draft, ${s.deprecated} deprecated · ` +
      `Trust: ${t["human-reviewed"]} human-reviewed, ${t["machine-confirmed"]} machine-confirmed, ` +
      `${t.unverified} unverified · ${inventory.stale} stale`,
  )
  if (inventory.untyped > 0)
    out.push(paint(io, "yellow", `${inventory.untyped} concepts have no usable type`))
  const section = (title: string, counts: readonly Count[]) => {
    out.push("", paint(io, "bold", title))
    if (counts.length === 0) out.push(paint(io, "dim", "  (none)"))
    const width = Math.max(0, ...counts.map((c) => String(c.count).length))
    for (const c of counts) out.push(`  ${String(c.count).padStart(width)}  ${c.value}`)
  }
  section("Types", inventory.types)
  section("Tags", inventory.tags)
  section("Frontmatter keys", inventory.keys)
  out.push("", paint(io, "bold", "Near-duplicates"))
  if (inventory.nearDuplicates.length === 0) out.push(paint(io, "dim", "  (none found)"))
  for (const group of inventory.nearDuplicates) {
    const values = group.values.map((v) => `${v.value} (${v.count})`).join(", ")
    const why = group.reasons.map((r) => REASONS[r]).join(", ")
    out.push(`  ${group.field}: ${values} ${paint(io, "dim", `- ${why}`)}`)
  }
  return `${out.join("\n")}\n`
}
