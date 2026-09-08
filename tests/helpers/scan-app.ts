import { readdirSync } from "node:fs"
import { join, relative } from "node:path"

function toRoute(appRelDir: string): string {
  if (!appRelDir || appRelDir === ".") return "/"
  const segments = appRelDir.replace(/\\/g, "/").split("/").filter(Boolean)
  const mapped = segments.map((seg) => {
    const dynamic = seg.match(/^\[([^\]]+)\]$/)
    if (dynamic) return `:${dynamic[1]}`
    return seg
  })
  return "/" + mapped.join("/")
}

export function findAppPages(root = process.cwd()): string[] {
  const appDir = join(root, "app")
  const pages: string[] = []

  function walk(dir: string) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "api") continue
        walk(full)
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        pages.push(toRoute(relative(appDir, dir)))
      }
    }
  }

  walk(appDir)
  return [...new Set(pages)].sort()
}

export function findApiRoutes(root = process.cwd()): string[] {
  const apiDir = join(root, "app", "api")
  const routes: string[] = []

  function walk(dir: string) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (/^route\.(ts|js)$/.test(entry.name)) {
        const rel = relative(join(root, "app"), dir).replace(/\\/g, "/")
        routes.push(toRoute(rel))
      }
    }
  }

  walk(apiDir)
  return [...new Set(routes)].sort()
}

export function readExportedHttpMethods(fileContents: string): string[] {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
  return methods.filter((m) => new RegExp(`export\\s+async\\s+function\\s+${m}\\b|export\\s+function\\s+${m}\\b|export\\s+const\\s+${m}\\b`).test(fileContents))
}
