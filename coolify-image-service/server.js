const express = require('express')
const sharp = require('sharp')
const { LRUCache } = require('lru-cache')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const dns = require('dns').promises
const {
  ALLOWED_HOSTS,
  SHIKIMORI_MIRRORS,
  getExtraAllowedHosts,
  isAllowedHost,
  getReferer,
  isSlowHost,
  getFetchCandidates,
  decodeDataUri,
  parseImageParams,
  contentTypeForFormat,
} = require('./url-policy')

const app = express()
const PORT = process.env.PORT || 3100
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://weeb-x.com'
// Свои хосты (например, <project>.supabase.co для загруженных обложек)
// разрешаем только явно, через env: общий *.supabase.co открывать нельзя.
const EXTRA_ALLOWED_HOSTS = getExtraAllowedHosts(process.env)

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

// Белый список хостов, referer-ы и ротация зеркал вынесены в url-policy.js
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

function buildFetchHeaders(hostname) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  }
  // Referer считаем для КАЖДОГО кандидата: при ротации зеркал Shikimori
  // реферер от .one на .io/.me может не подойти анти-хотлинку.
  const referer = getReferer(hostname)
  if (referer) headers['Referer'] = referer
  if (hostname.includes('remanga.org') || hostname.includes('img.reimg.org')) {
    headers['Origin'] = 'https://remanga.org'
  }
  return headers
}

async function fetchOnce(url, headers, timeoutMs) {
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
      let host = url
      try { host = new URL(url).hostname } catch {}
      throw new Error(`Fetch timeout (${timeoutMs / 1000}s): ${host}`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchImage(url) {
  // data:image/... не надо фетчить — картинка уже в URL. Раньше такие адреса
  // уходили в allowlist и получали «Host not allowed: » (у data-URI нет хоста).
  const inlineImage = decodeDataUri(url)
  if (inlineImage) return inlineImage

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL: ' + String(url).slice(0, 200))
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported protocol: ' + parsed.protocol)
  }
  if (!isAllowedHost(parsed.hostname, EXTRA_ALLOWED_HOSTS)) {
    throw new Error('Host not allowed: ' + parsed.hostname)
  }

  const timeoutMs = isSlowHost(parsed.hostname) ? 30000 : 15000
  // Ротация для ЛЮБОГО домена shikimori.*, а не только .one: ссылки на
  // зеркала тоже надолго оседают в БД и в кэше браузера.
  const candidates = getFetchCandidates(url)

  let lastError
  for (const candidate of candidates) {
    const candidateHost = new URL(candidate).hostname
    try {
      await acquireFetchSlot()
      try {
        return await fetchOnce(candidate, buildFetchHeaders(candidateHost), timeoutMs)
      } finally {
        releaseFetchSlot()
      }
    } catch (err) {
      lastError = err
      if (candidate !== url) {
        console.warn(`[image-service] Зеркало ${candidateHost} не ответило (${err.message}), пробуем следующее`)
      }
    }
  }

  throw lastError
}

// --- Detect content-type from buffer magic bytes ---
function detectContentType(buffer, fallback = 'image/jpeg') {
  // SVG (в т.ч. сгенерированные обложки-заглушки) не имеет магических байт —
  // без этой проверки data:image/svg+xml отдавался бы как image/jpeg.
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(buffer.subarray(0, 256).toString('utf8'))) return 'image/svg+xml'
  if (buffer.length < 4) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png'
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp'
  if (buffer.length >= 12 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x00 && buffer[8] === 0x66) return 'image/avif'
  // Если магические байты не узнали, но апстрим/дата-URI честно сказал
  // image/* — верим ему, а не подсовываем image/jpeg.
  return typeof fallback === 'string' && /^image\//i.test(fallback) ? fallback : 'image/jpeg'
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
// Обычный /health должен оставаться мгновенным: его дёргает Docker
// HEALTHCHECK каждые 30с. Но «процесс жив» != «картинки грузятся» — поэтому
// для диагностики есть /health?deep=1 с короткой проверкой апстрима.
app.get('/health', async (req, res) => {
  const body = {
    status: 'ok',
    cacheSize: cache.size,
    cacheItems: cache.size,
    activeFetches,
    queuedFetches: fetchQueue.length,
    allowedHosts: ALLOWED_HOSTS.length + EXTRA_ALLOWED_HOSTS.length,
    extraAllowedHosts: EXTRA_ALLOWED_HOSTS,
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  }

  if (req.query.deep === '1') {
    const started = Date.now()
    try {
      await dns.resolve4('shikimori.one')
      const { buffer } = await fetchOnce(
        'https://shikimori.one/system/characters/original/1.jpg',
        buildFetchHeaders('shikimori.one'),
        4000
      )
      body.upstream = { ok: true, bytes: buffer.length, ms: Date.now() - started }
    } catch (err) {
      body.upstream = { ok: false, error: err.message, ms: Date.now() - started }
    }
  }

  res.json(body)
})

// --- Connectivity test endpoint ---
// Раньше здесь последовательно опрашивались 4 зеркала, причём каждое через
// fetchImage() само запускало ротацию ещё на 4 запроса по 15с. Эндпоинт мог
// висеть минутами и диагностика «контейнер работает?» была бесполезной.
// Теперь всё параллельно, без каскадной ротации и с коротким таймаутом.
app.get('/test-connectivity', async (req, res) => {
  const testHosts = ['shikimori.one', 'safebooru.org', 'konachan.net']
  const results = {}

  await Promise.all(testHosts.map(async (host) => {
    try {
      const lookup = await dns.resolve4(host)
      results[host] = { dns: 'ok', ips: lookup }
    } catch (err) {
      results[host] = { dns: 'fail', error: err.message }
    }
  }))

  results.fetchTests = {}
  await Promise.all(SHIKIMORI_MIRRORS.map(async (mirror) => {
    try {
      const testUrl = `https://${mirror}/system/characters/original/1.jpg`
      const { buffer, contentType } = await fetchOnce(testUrl, buildFetchHeaders(mirror), 5000)
      results.fetchTests[mirror] = { ok: true, size: buffer.length, contentType }
    } catch (err) {
      results.fetchTests[mirror] = { ok: false, error: err.message }
    }
  }))

  const firstWorking = Object.entries(results.fetchTests).find(([, v]) => v.ok)
  results.fetchTest = firstWorking
    ? { ok: true, mirror: firstWorking[0], size: firstWorking[1].size, contentType: firstWorking[1].contentType }
    : { ok: false, error: 'Все зеркала Shikimori недоступны' }

  res.json(results)
})

// --- Optimize endpoint — replaces /_next/image ---
app.get('/optimize', async (req, res) => {
  let url = req.query.url
  // Мусор/NaN в query раньше уходил в sharp и отдавал 502 вместо картинки.
  const { width, quality, format } = parseImageParams(req.query)
  const contentType = contentTypeForFormat(format)

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

    const contentType = detectContentType(buffer, upstreamCt)
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
