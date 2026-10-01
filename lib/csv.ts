/** Encode one CSV cell and neutralize spreadsheet formula prefixes. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ""

  const serialized = typeof value === "object" ? JSON.stringify(value) : undefined
  const raw = serialized ?? String(value)
  // Excel and similar spreadsheet programs may evaluate cells that start with
  // =, +, -, or @, including after whitespace/control characters.
  const safe = /^[\u0000-\u0020\u007f\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw

  if (safe.includes('"') || safe.includes(",") || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}
