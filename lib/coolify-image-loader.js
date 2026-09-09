const IMAGE_SERVER_URL = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL || ''

function coolifyImageLoader({ src, width, quality }) {
  if (!src) return src

  // Local paths (e.g. /catgirl_tutorial.png, /icon.svg) — serve directly
  if (src.startsWith('/') && !src.startsWith('//')) return src

  // Data URIs — serve directly
  if (src.startsWith('data:')) return src

  // Already proxied URL (getProxiedSrc result passed to Image) — return as-is
  if (IMAGE_SERVER_URL && src.startsWith(IMAGE_SERVER_URL)) return src

  // Route through Coolify image service
  if (IMAGE_SERVER_URL) {
    return `${IMAGE_SERVER_URL}/optimize?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 60}&f=webp`
  }

  // Fallback when NEXT_PUBLIC_IMAGE_SERVER_URL was not baked into the client
  // bundle at build time: use the site's own proxy route. It works at runtime
  // because the route 302-redirects to the image service via the server-side
  // IMAGE_SERVICE_URL env var.
  //
  // IMPORTANT: never fall back to `/_next/image?url=...` — when a custom
  // loader is configured, Next.js does not serve the built-in optimizer
  // endpoint and such URLs return 404 in production.
  return `/api/image-proxy?url=${encodeURIComponent(src)}`
}

module.exports = coolifyImageLoader
