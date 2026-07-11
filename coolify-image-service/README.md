# WEEB-X Image Service

Image optimization and proxy service for WEEB-X, deployed on Coolify.

## Features

- **`/optimize?url=...&w=...&q=...&f=...`** — Optimizes and resizes images (replaces Vercel's `/_next/image`)
- **`/proxy?url=...`** — Pass-through proxy for external images (replaces `/api/image-proxy`)
- **Memory + Disk caching** — LRU cache (100MB memory) + persistent disk cache
- **Sharp optimization** — AVIF/WebP/JPEG with mozjpeg
- **Domain-specific referer headers** — bypasses hotlink protection

## Deploy on Coolify

1. Create a new service in Coolify (Dockerfile or Nixpacks)
2. Set environment variables:
   ```
   PORT=3100
   CORS_ORIGIN=https://weeb-x.com
   ```
3. Deploy

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `CORS_ORIGIN` | `https://weeb-x.com` | Allowed CORS origin |

## Endpoints

### GET /optimize
Query params:
- `url` — source image URL (required)
- `w` — target width in px (default: 384)
- `q` — quality 1-100 (default: 60)
- `f` — format: `webp`, `avif`, `jpeg` (default: webp)

### GET /proxy
Query params:
- `url` — source image URL (required)

### GET /health
Returns service status and cache info.
