/** Bundle-relative POSIX path helpers. No `node:path`: this runs in browsers and Workers. */

/** Directory of a bundle-relative path (`""` for the root). */
export function dirname(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1)
}

/**
 * Join and normalize path segments, resolving `.` and `..`. Returns
 * `undefined` when the result would climb above the root.
 */
export function normalize(...parts: string[]): string | undefined {
  const out: string[] = []
  for (const segment of parts.join("/").split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (out.length === 0) return undefined
      out.pop()
    } else {
      out.push(segment)
    }
  }
  return out.join("/")
}

/** A URL scheme (`https:`, `mailto:`) or protocol-relative (`//host`) destination. */
export function isExternal(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")
}

/** Convert a glob (relative to the tree root) to a regular expression.
 * `*` and `?` stay within one path segment, `**` crosses segments, and a
 * trailing `/` matches everything under a directory. */
export function globToRegExp(glob: string): RegExp {
  const pattern = glob.replace(/^\.?\//, "").replace(/\/$/, "/**")
  let source = ""
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i] as string
    if (char === "*" && pattern[i + 1] === "*") {
      const slash = pattern[i + 2] === "/"
      source += slash ? "(?:.*/)?" : ".*"
      i += slash ? 2 : 1
    } else if (char === "*") {
      source += "[^/]*"
    } else if (char === "?") {
      source += "[^/]"
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    }
  }
  return new RegExp(`^${source}$`)
}
