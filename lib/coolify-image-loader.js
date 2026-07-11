const IMAGE_SERVER_URL = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL || ''

function coolifyImageLoader({ src, width, quality }) {
  if (!src) return src

  // If no Coolify server configured, fall back to Vercel's default
  if (!IMAGE_SERVER_URL) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 60}`
  }

  // Local paths (e.g. /catgirl_tutorial.png, /icon.svg) — serve directly
  if (src.startsWith('/') && !src.startsWith('//')) return src

  // Data URIs — serve directly
  if (src.startsWith('data:')) return src

  // Already proxied URL (getProxiedSrc result passed to Image) — return as-is
  if (src.startsWith(IMAGE_SERVER_URL)) return src

  // Route through Coolify image service
  return `${IMAGE_SERVER_URL}/optimize?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 60}&f=webp`
}

module.exports = coolifyImageLoader
