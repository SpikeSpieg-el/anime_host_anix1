/**
 * Helper for validating a Postgres connection string.
 *
 * Lives in a plain module (outside the Route Handler) because files under
 * app/api can only export valid Next.js Route fields, not arbitrary helpers,
 * which would break next build type checking.
 */

/** Minimal format check for a Postgres connection string. */
export function isValidPostgresUrl(raw: string): boolean {
  if (!raw || !raw.includes('://')) return false
  try {
    // Разбираем как URL, чтобы отсечь мусор и инъекции.
    const url = new URL(raw)
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  } catch {
    return false
  }
}
