const CHUNK_LOAD_ERROR_RE = /(?:ChunkLoadError|Loading\s+(?:CSS\s+)?chunk|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script)/i

/**
 * Detects errors caused by a stale or unavailable Next.js/webpack chunk.
 * These are recoverable with a full navigation after a deployment, unlike
 * ordinary render errors that need to remain visible for diagnosis.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return CHUNK_LOAD_ERROR_RE.test(`${error.name}: ${error.message}`)
  }

  if (error && typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown }
    return CHUNK_LOAD_ERROR_RE.test(`${String(candidate.name ?? "")}: ${String(candidate.message ?? "")}`)
  }

  return CHUNK_LOAD_ERROR_RE.test(String(error ?? ""))
}
