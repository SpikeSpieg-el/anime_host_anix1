const express = require('express')
const sharp = require('sharp')
const { LRUCache } = require('lru-cache')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const dns = require('dns').promises

const app = express()
const PORT = process.env.PORT || 3100
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://weeb-x.com'

// --- Email (nodemailer) ---
const nodemailer = require('nodemailer')

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM = process.env.SMTP_FROM || 'Weeb-X <mail@weeb-x.com>'
const MAIL_API_TOKEN = process.env.MAIL_API_TOKEN || ''

let mailTransporter = null

function getMailTransporter() {
  if (mailTransporter) return mailTransporter
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null

  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  })

  return mailTransporter
}

// --- Concurrency limiter (prevents FD exhaustion and overload) ---
const MAX_CONCURRENT_FETCHES = parseInt(process.env.MAX_CONCURRENT_FETCHES || '20', 10)
let activeFetches = 0
const fetchQueue = []

function acquireFetchSlot() {
  return new Promise(resolve => {
    if (activeFetches < MAX_CONCURRENT_FETCHES) {
      activeFetches++
      resolve()
    } else {
      fetchQueue.push(resolve)
    }
  })
}

function releaseFetchSlot() {
  activeFetches--
  if (fetchQueue.length > 0) {
    const next = fetchQueue.shift()
    activeFetches++
    next()
  }
}

// --- Allowed hosts for proxying ---
const ALLOWED_HOSTS = [
  // Booru/image boards
  'konachan.net',
  'safebooru.org',
  'danbooru.donmai.us',
  'zerochan.net',
  's3.zerochan.net',
  'static.zerochan.net',
  'yande.re',
  'files.yande.re',
  // Anime databases
  'shikimori.one',
  'shikimori.io',
  'shikimori.org',
  'anilist.co',
  's4.anilist.co',
  'kitsu.app',
  'media.kitsu.app',
  'media.kitsu.io',
  'cdn.myanimelist.net',
  'myanimelist.net',
  'api.jikan.moe',
  'kodikapi.com',
  'kodik.info',
  'cdn.kodik.info',
  'img.youtube.com',
  'i.ytimg.com',
  'api.anilibria.tv',
  // Manga
  'mixlib.me',
  'mangalib.me',
  'remanga.org',
  'reimg2.org',
  'img.reimg.org',
  'uploads.mangadex.org',
  'meo.comick.pictures',
  'cdn.mangaeden.com',
  // Pinterest (custom arts)
  'pinimg.com',
  'i.pinimg.com',
  // Common image hosts for custom arts
  'imgur.com',
  'i.imgur.com',
  'discordapp.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'github.com',
  'objects.githubusercontent.com',
  'picsum.photos',
  'transparenttextures.com',
  'catbox.moe',
  'files.catbox.moe',
  'litterbox.catbox.moe',
  'postimg.cc',
  'postimg.org'
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
    'shikimori.io': 'https://shikimori.io/',
    'shikimori.org': 'https://shikimori.org/',
    'remanga.org': 'https://remanga.org/',
    'reimg2.org': 'https://remanga.org/',
    'img.reimg.org': 'https://remanga.org/',
    'uploads.mangadex.org': 'https://mangadex.org/',
    'yande.re': 'https://yande.re/',
    'files.yande.re': 'https://yande.re/',
    'pinimg.com': 'https://www.pinterest.com/',
    'i.pinimg.com': 'https://www.pinterest.com/',
    'anilist.co': 'https://anilist.co/',
    's4.anilist.co': 'https://anilist.co/',
    'kitsu.app': 'https://kitsu.io/',
    'media.kitsu.app': 'https://kitsu.io/',
    'media.kitsu.io': 'https://kitsu.io/',
    'kodikapi.com': 'https://kodik.info/',
    'kodik.info': 'https://kodik.info/',
    'cdn.kodik.info': 'https://kodik.info/',
    'cdn.myanimelist.net': 'https://myanimelist.net/',
    'myanimelist.net': 'https://myanimelist.net/',
    'danbooru.donmai.us': 'https://danbooru.donmai.us/',
    'static.zerochan.net': 'https://www.zerochan.net/',
    'img.youtube.com': 'https://www.youtube.com/',
    'i.ytimg.com': 'https://www.youtube.com/',
    'api.anilibria.tv': 'https://api.anilibria.tv/'
  }
  for (const [key, val] of Object.entries(referers)) {
    if (hostname.includes(key)) return val
  }
  return ''
}

// --- In-memory cache for images (100MB) ---
const cache = new LRUCache({
  maxSize: 100 * 1024 * 1024,
  sizeCalculation: (value) => value.length,
  ttl: 1000 * 60 * 60 * 24 * 7 // 7 days
})

// --- Disk cache directory ---
const DISK_CACHE_DIR = path.join(__dirname, 'cache')
if (!fs.existsSync(DISK_CACHE_DIR)) {
  fs.mkdirSync(DISK_CACHE_DIR, { recursive: true })
}

function getCacheKey(url, width, quality, format) {
  // Use MD5 hash to keep filenames short and avoid ENAMETOOLONG errors
  const hash = crypto.createHash('md5').update(url).digest('hex')
  return `${hash}_${width}_${quality}_${format}`
}

function getDiskCachePath(cacheKey) {
  return path.join(DISK_CACHE_DIR, cacheKey + '.bin')
}

// --- Fetch image using native fetch (Node 20+) with proper AbortController ---
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
    'Connection': 'keep-alive',
  }

  if (parsed.hostname.includes('remanga.org') || parsed.hostname.includes('img.reimg.org')) {
    headers['Origin'] = 'https://remanga.org'
  }

  await acquireFetchSlot()

  // Slow hosts get longer timeout
  const slowHosts = ['files.yande.re', 'yande.re', 'konachan.net', 'zerochan.net', 's3.zerochan.net']
  const isSlowHost = slowHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
  const timeoutMs = isSlowHost ? 30000 : 15000

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow'
    })

    if (!res.ok) throw new Error(`Upstream ${res.status}`)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 100) throw new Error('Response too small')

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    return { buffer, contentType }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Fetch timeout (${timeoutMs / 1000}s): ${parsed.hostname}`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
    releaseFetchSlot()
  }
}

// --- Detect content-type from buffer magic bytes ---
function detectContentType(buffer) {
  if (buffer.length < 4) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png'
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp'
  if (buffer.length >= 12 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x00 && buffer[8] === 0x66) return 'image/avif'
  return 'image/jpeg'
}

async function optimizeImage(buffer, width, quality, format) {
  let pipeline = sharp(buffer, { failOnError: false })

  pipeline = pipeline.resize({
    width: width,
    withoutEnlargement: true,
    fit: 'inside'
  })

  if (format === 'avif') {
    pipeline = pipeline.avif({ quality: Math.min(quality, 50) })
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality })
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true })
  }

  return pipeline.toBuffer()
}

// --- Request timeout middleware (30s max per request) ---
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout' })
    }
  })
  next()
})

// --- CORS middleware ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// --- JSON body parser (for email endpoint) ---
app.use(express.json({ limit: '1mb' }))

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cacheSize: cache.size,
    cacheItems: cache.size,
    activeFetches,
    queuedFetches: fetchQueue.length,
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  })
})

// --- Connectivity test endpoint ---
app.get('/test-connectivity', async (req, res) => {
  const testHosts = ['shikimori.one', 'safebooru.org', 'konachan.net']
  const results = {}

  for (const host of testHosts) {
    try {
      const lookup = await dns.resolve4(host)
      results[host] = { dns: 'ok', ips: lookup }
    } catch (err) {
      results[host] = { dns: 'fail', error: err.message }
    }
  }

  // Test actual fetch to a small image
  try {
    const testUrl = 'https://shikimori.one/system/characters/original/1.jpg'
    const { buffer, contentType } = await fetchImage(testUrl)
    results.fetchTest = { ok: true, size: buffer.length, contentType }
  } catch (err) {
    results.fetchTest = { ok: false, error: err.message }
  }

  res.json(results)
})

// --- Optimize endpoint — replaces /_next/image ---
app.get('/optimize', async (req, res) => {
  let url = req.query.url
  const width = parseInt(req.query.w || req.query.width || '384', 10)
  const quality = parseInt(req.query.q || req.query.quality || '60', 10)
  const format = req.query.f || req.query.format || 'webp'

  if (!url) return res.status(400).json({ error: 'Missing url' })

  // Unwrap self-referencing URLs (e.g. img.weeb-x.com:8443/proxy?url=...)
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '/proxy' && parsed.searchParams.get('url')) {
      url = parsed.searchParams.get('url')
    }
  } catch {}

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
      try { fs.unlinkSync(diskPath) } catch {}
    }
  }

  // Fetch and optimize
  try {
    const { buffer: rawBuffer } = await fetchImage(url)
    const optimized = await optimizeImage(rawBuffer, width, quality, format)

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

// --- Proxy endpoint — replaces /api/image-proxy (pass-through, no optimization) ---
app.get('/proxy', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url' })

  const cacheKey = 'proxy_' + crypto.createHash('md5').update(url).digest('hex')

  // Check memory cache
  const memCached = cache.get(cacheKey)
  if (memCached) {
    const contentType = detectContentType(memCached)
    res.set('Content-Type', contentType)
    res.set('X-Cache', 'HIT-MEM')
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.set('Access-Control-Allow-Origin', '*')
    return res.send(memCached)
  }

  // Check disk cache
  const diskPath = getDiskCachePath(cacheKey)
  if (fs.existsSync(diskPath)) {
    try {
      const diskData = fs.readFileSync(diskPath)
      cache.set(cacheKey, diskData)
      const contentType = detectContentType(diskData)
      res.set('Content-Type', contentType)
      res.set('X-Cache', 'HIT-DISK')
      res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      res.set('Access-Control-Allow-Origin', '*')
      return res.send(diskData)
    } catch (e) {
      try { fs.unlinkSync(diskPath) } catch {}
    }
  }

  try {
    const { buffer, contentType: upstreamCt } = await fetchImage(url)
    cache.set(cacheKey, buffer)
    try {
      fs.writeFileSync(diskPath, buffer)
    } catch (e) {
      console.warn('[disk-cache] Write failed:', e.message)
    }

    const contentType = detectContentType(buffer)
    res.set('Content-Type', contentType)
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.set('Access-Control-Allow-Origin', '*')
    res.send(buffer)
  } catch (err) {
    console.error('[proxy] Error:', err.message, 'url:', url)
    res.status(502).json({ error: err.message })
  }
})

// --- Send email endpoint (password reset, notifications) ---
app.post('/send-email', async (req, res) => {
  try {
    // Auth check
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    if (!MAIL_API_TOKEN || token !== MAIL_API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { to, subject, html, text } = req.body || {}

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' })
    }

    const transporter = getMailTransporter()
    if (!transporter) {
      console.error('[mail] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS')
      return res.status(503).json({ error: 'Email service not configured' })
    }

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
    })

    console.log(`[mail] Sent to ${to}: ${info.messageId}`)
    res.json({ success: true, messageId: info.messageId })
  } catch (err) {
    console.error('[mail] Send error:', err.message)
    res.status(500).json({ error: 'Failed to send email: ' + err.message })
  }
})

// --- Start server ---
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[image-service] Running on port ${PORT}`)
  console.log(`[image-service] CORS origin: ${CORS_ORIGIN}`)
  console.log(`[image-service] Disk cache: ${DISK_CACHE_DIR}`)
  console.log(`[image-service] Max concurrent fetches: ${MAX_CONCURRENT_FETCHES}`)
  console.log(`[image-service] Email service: ${SMTP_HOST ? 'configured (' + SMTP_HOST + ':' + SMTP_PORT + ')' : 'NOT configured'}`)

  // Test DNS resolution on startup
  dns.resolve4('shikimori.one').then(() => {
    console.log('[image-service] DNS test: shikimori.one resolved OK')
  }).catch(err => {
    console.error('[image-service] DNS test FAILED for shikimori.one:', err.message)
    console.error('[image-service] Container may not have network access to external hosts!')
  })
})

// --- Graceful shutdown ---
process.on('SIGTERM', () => {
  console.log('[image-service] SIGTERM received, shutting down...')
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[image-service] SIGINT received, shutting down...')
  server.close(() => process.exit(0))
})

// --- Catch unhandled errors to prevent crashes ---
process.on('unhandledRejection', (err) => {
  console.error('[image-service] Unhandled rejection:', err.message)
})

process.on('uncaughtException', (err) => {
  console.error('[image-service] Uncaught exception:', err.message)
})
