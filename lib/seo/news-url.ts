import { slugifyAnimeTitle, safeDecodeSegment } from "@/lib/seo/watch-url"

const NUMERIC_NEWS_SEGMENT_RE = /^(\d+)(?:-([a-z0-9-]*))?$/i
const CUSTOM_NEWS_SEGMENT_RE = /^(custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-([a-z0-9-]*))?$/i

export function parseNewsParam(param: string): string {
  const segment = safeDecodeSegment(param)
  const match = NUMERIC_NEWS_SEGMENT_RE.exec(segment) ?? CUSTOM_NEWS_SEGMENT_RE.exec(segment)
  return match ? match[1] : segment
}

export function getNewsSegment(id: string | number, title?: string | null): string {
  const idString = String(id)
  const slug = slugifyAnimeTitle(title)
  const supportsSlug = /^\d+$/.test(idString) || /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idString)
  return supportsSlug && slug ? `${idString}-${slug}` : idString
}

export function getNewsPath(id: string | number, title?: string | null): string {
  return `/news/${getNewsSegment(id, title)}`
}
