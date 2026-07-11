const express = require('express')
const sharp = require('sharp')
const fetch = require('node-fetch')
const { LRUCache } = require('lru-cache')
const path = require('path')
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 3100
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://weeb-x.com'

// Allowed hosts for proxying
const ALLOWED_HOSTS = [
  'konachan.net',
  'safebooru.org',
  'zerochan.net',
  's3.zerochan.net',
  'yande.re',
  'files.yande.re',
  'shikimori.one',
  'mixlib.me',
  'mangalib.me',
  'remanga.org',
  'reimg2.org',
  'img.reimg.org',
  'uploads.mangadex.org',
  'pinimg.com',
  'i.pinimg.com',
  'picsum.photos',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'cdn.myanimelist.net',
  'api.jikan.moe'
]

// Domain-specific referer headers
function getReferer(hostname) {
  const referers = {
    'konachan.net': 'https://konachan.net/',
    'safebooru.org': 'https://safebooru.org/',
    'zerochan.net': 'https://www.zerochan.net/',
    's3.zerochan.net': 'https://www.zerochan.net/',
    'mixlib.me': 'https://mangalib.me/',
    'mangalib.me': 'https://mangalib.me/',
    'shikimori.one': 'https://shikimori.one/',
    'remanga.org': 'https://remanga.org/',
    'reimg2.org': 'https://remanga.org/',
    'img.reimg.org': 'https://remanga.org/',
    'uploads.mangadex.org': 'https://mangadex.org/',
    'yande.re': 'https://yande.re/',
    'files.yande.re': 'https://yande.re/',
    'pinimg.com': 'https://www.pinterest.com/',
    'i.pinimg.com': 'https://www.pinterest.com/'
  }
  for (const [key, val] of Object.entries(referers)) {
    if (hostname.includes(key)) return val
  }
  return ''
}

// In-memory cache for optimized images (100MB)
const cache = new LRUCache({
  maxSize: 100 * 1024 * 1024,
  sizeCalculation: (value) => value.length,
  ttl: 1000 * 60 * 60 * 24 * 7 // 7 days
})

// Disk cache directory
const DISK_CACHE_DIR = path.join(__dirname, 'cache')
if (!fs.existsSync(DISK_CACHE_DIR)) {
  fs.mkdirSync(DISK_CACHE_DIR, { recursive: true })
}

function getCacheKey(url, width, quality, format) {
  return `${Buffer.from(url).toString('base64')}_${width}_${quality}_${format}`
}

function getDiskCachePath(cacheKey) {
  return path.join(DISK_CACHE_DIR, cacheKey + '.bin')
}

async function fetchImage(url) {
  const parsed = new URL(url)
  const isAllowed = ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
  if (!isAllowed) {
    throw new Error('Host not allowed: ' + parsed.hostname)
  }

  const referer = getReferer(parsed.hostname)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': referer,
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  }

  if (parsed.hostname.includes('remanga.org') || parsed.hostname.includes('img.reimg.org')) {
    headers['Origin'] = 'https://remanga.org'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`Upstream ${res.status}`)
    const buffer = await res.buffer()
    if (buffer.length < 100) throw new Error('Response too small')
    return buffer
  } finally {
    clearTimeout(timeout)
  }
}

async function optimizeImage(buffer, width, quality, format) {
  let pipeline = sharp(buffer, { failOnError: false })

  // Resize only if wider than target
  pipeline = pipeline.resize({
    width: width,
    withoutEnlargement: true,
    fit: 'inside'
  })

  // Convert format
  if (format === 'avif') {
    pipeline = pipeline.avif({ quality: Math.min(quality, 50) })
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality })
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true })
  }

  return pipeline.toBuffer()
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cacheSize: cache.size, cacheItems: cache.size })
})

// Optimize endpoint — replaces /_next/image
app.get('/optimize', async (req, res) => {
  const url = req.query.url
  const width = parseInt(req.query.w || req.query.width || '384', 10)
  const quality = parseInt(req.query.q || req.query.quality || '60', 10)
  const format = req.query.f || req.query.format || 'webp'

  if (!url) return res.status(400).json({ error: 'Missing url' })

  const cacheKey = getCacheKey(url, width, quality, format)

  // Check memory cache
  const memCached = cache.get(cacheKey)
  if (memCached) {
    const contentType = format === 'avif' ? 'image/avif' : format === 'webp' ? 'image/webp' : 'image/jpeg'
    res.set('Content-Type', contentType)
    res.set('X-Cache', 'HIT-MEM')
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    return res.send(memCached)
  }

  // Check disk cache
  const diskPath = getDiskCachePath(cacheKey)
  if (fs.existsSync(diskPath)) {
    try {
      const diskData = fs.readFileSync(diskPath)
      cache.set(cacheKey, diskData)
      const contentType = format === 'avif' ? 'image/avif' : format === 'webp' ? 'image/webp' : 'image/jpeg'
      res.set('Content-Type', contentType)
      res.set('X-Cache', 'HIT-DISK')
      res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      return res.send(diskData)
    } catch (e) {
      // Corrupt cache file, remove it
      try { fs.unlinkSync(diskPath) } catch {}
    }
  }

  // Fetch and optimize
  try {
    const rawBuffer = await fetchImage(url)
    const optimized = await optimizeImage(rawBuffer, width, quality, format)

    // Cache in memory and disk
    cache.set(cacheKey, optimized)
    try {
      fs.writeFileSync(diskPath, optimized)
    } catch (e) {
      console.warn('[disk-cache] Write failed:', e.message)
    }

    const contentType = format === 'avif' ? 'image/avif' : format === 'webp' ? 'image/webp' : 'image/jpeg'
    res.set('Content-Type', contentType)
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.send(optimized)
  } catch (err) {
    console.error('[optimize] Error:', err.message, 'url:', url)
    res.status(502).json({ error: err.message })
  }
})

// Proxy endpoint — replaces /api/image-proxy (no optimization, just pass-through)
app.get('/proxy', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url' })

  const cacheKey = 'proxy_' + Buffer.from(url).toString('base64')

  // Check memory cache
  const memCached = cache.get(cacheKey)
  if (memCached) {
    res.set('Content-Type', 'image/jpeg')
    res.set('X-Cache', 'HIT-MEM')
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.set('Access-Control-Allow-Origin', '*')
    return res.send(memCached)
  }

  try {
    const buffer = await fetchImage(url)
    cache.set(cacheKey, buffer)
    res.set('Content-Type', 'image/jpeg')
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.set('Access-Control-Allow-Origin', '*')
    res.send(buffer)
  } catch (err) {
    console.error('[proxy] Error:', err.message, 'url:', url)
    res.status(502).json({ error: err.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[image-service] Running on port ${PORT}`)
  console.log(`[image-service] CORS origin: ${CORS_ORIGIN}`)
  console.log(`[image-service] Disk cache: ${DISK_CACHE_DIR}`)
})
