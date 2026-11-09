'use strict'

/**
 * Чистые (без express/sharp/сети) правила для img-сервиса.
 *
 * Вынесены в отдельный модуль по двум причинам:
 *  1. их можно проверять юнит-тестами, не поднимая сервер и не устанавливая
 *     зависимости контейнера;
 *  2. именно здесь живёт белый список хостов — самый частый источник
 *     «часть обложек не грузится, хотя контейнер healthy».
 */

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
  'shikimori.me',
  'shikimori.io',
  'shikimori.org',
  'anilist.co',
  's4.anilist.co',
  'kitsu.app',
  'media.kitsu.app',
  'media.kitsu.io',
  // Kitsu returns signed poster URLs from this Backblaze B2 S3 bucket.
  'kitsu-production-media.s3.us-west-002.backblazeb2.com',
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

// Зеркала Shikimori: основной домен периодически целиком отдаёт 522, а
// остальные живы. Ротация нужна для ЛЮБОГО зеркала, а не только для .one:
// ссылки с .io/.me/.org тоже сохраняются в БД и кэше.
const SHIKIMORI_MIRRORS = [
  'shikimori.one',
  'shikimori.me',
  'shikimori.io',
  'shikimori.org',
]

const REFERERS = {
  'konachan.net': 'https://konachan.net/',
  'safebooru.org': 'https://safebooru.org/',
  'zerochan.net': 'https://www.zerochan.net/',
  's3.zerochan.net': 'https://www.zerochan.net/',
  'mixlib.me': 'https://mangalib.me/',
  'mangalib.me': 'https://mangalib.me/',
  'shikimori.one': 'https://shikimori.one/',
  'shikimori.me': 'https://shikimori.me/',
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
  'kitsu-production-media.s3.us-west-002.backblazeb2.com': 'https://kitsu.io/',
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

const SLOW_HOSTS = ['files.yande.re', 'yande.re', 'konachan.net', 'zerochan.net', 's3.zerochan.net']

function normalizeHostname(value) {
  let host = String(value || '').trim().toLowerCase().replace(/\.$/, '')
  // В переменных окружения иногда передают сразу URL, а не голый хост.
  if (host.includes('://')) {
    try { host = new URL(host).hostname.toLowerCase() } catch { /* оставляем как есть */ }
  }
  return host.split(':')[0].split('/')[0]
}

/**
 * Дополнительные хосты, которые разрешены только через env.
 *
 * Зачем: собственные загрузки (аватары, арты, баннеры) лежат в Supabase
 * Storage на адресе вида <project>.supabase.co. Раньше supabase.co убрали из
 * общего списка из соображений безопасности, но кастомный next/image loader
 * всё равно отправляет такие URL в /optimize — сервис отвечал 502
 * «Host not allowed». Вместо того чтобы снова открывать вообще все
 * *.supabase.co, даём владельцу явно указать свой хост.
 */
function getExtraAllowedHosts(env = process.env) {
  const hosts = []
  const raw = env.EXTRA_ALLOWED_HOSTS || ''
  for (const part of String(raw).split(/[\s,;]+/)) {
    const host = normalizeHostname(part)
    if (host) hosts.push(host)
  }
  const supabaseHost = normalizeHostname(env.SUPABASE_STORAGE_HOST || '')
  if (supabaseHost && !hosts.includes(supabaseHost)) hosts.push(supabaseHost)
  return hosts
}

function isAllowedHost(hostname, extraHosts = []) {
  const host = normalizeHostname(hostname)
  if (!host) return false
  return [...ALLOWED_HOSTS, ...extraHosts].some(
    allowed => host === allowed || host.endsWith('.' + allowed)
  )
}

function getReferer(hostname) {
  const host = normalizeHostname(hostname)
  for (const [key, value] of Object.entries(REFERERS)) {
    if (host === key || host.endsWith('.' + key)) return value
  }
  return ''
}

function isSlowHost(hostname) {
  const host = normalizeHostname(hostname)
  return SLOW_HOSTS.some(slow => host === slow || host.endsWith('.' + slow))
}

/**
 * Кандидаты для загрузки. Исходный URL ВСЕГДА первый: если зеркало живо,
 * не платим за лишние запросы. Для любого сломавшегося зеркала Shikimori
 * пробуем остальные, сохраняя путь и query (в них подпись/версия картинки).
 */
function getFetchCandidates(url) {
  let parsed
  try { parsed = new URL(url) } catch { return [url] }

  const host = normalizeHostname(parsed.hostname)
  if (!SHIKIMORI_MIRRORS.includes(host)) return [url]

  const candidates = [url]
  for (const mirror of SHIKIMORI_MIRRORS) {
    if (mirror === host) continue
    const candidate = new URL(url)
    candidate.hostname = mirror
    candidates.push(candidate.toString())
  }
  return candidates
}

/**
 * data:image/... уже содержит картинку — ходить в сеть за ней бессмысленно.
 * Раньше getProxiedSrc отправлял такие URL в /proxy, сервис отвечал 502
 * «Host not allowed: » (у data-URI нет hostname), и пропадали сгенерированные
 * обложки-заглушки. Поддерживаем base64 и url-encoded варианты, только image/*,
 * с ограничением размера.
 */
function decodeDataUri(url, maxBytes = 1024 * 1024) {
  if (typeof url !== 'string' || !/^data:/i.test(url)) return null
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(url)
  if (!match) return null

  const mediaType = (match[1] || '').toLowerCase()
  if (!mediaType.startsWith('image/')) return null

  let buffer
  try {
    buffer = match[2]
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8')
  } catch {
    return null
  }
  if (!buffer.length || buffer.length > maxBytes) return null
  return { buffer, contentType: mediaType }
}

/** Приводим w/q/f к валидным значениям: мусор в query не должен давать 502. */
function parseImageParams(query = {}) {
  const first = (value) => Array.isArray(value) ? value[0] : value
  const clamp = (value, fallback, min, max) => {
    const parsed = Number.parseInt(first(value), 10)
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback
  }

  const width = clamp(query.w ?? query.width, 384, 1, 8192)
  const quality = clamp(query.q ?? query.quality, 60, 1, 100)
  const rawFormat = String(first(query.f ?? query.format) ?? 'webp').toLowerCase()
  const format = ['webp', 'avif', 'jpeg'].includes(rawFormat)
    ? rawFormat
    : rawFormat === 'jpg' ? 'jpeg' : 'webp'

  return { width, quality, format }
}

function contentTypeForFormat(format) {
  return format === 'avif' ? 'image/avif' : format === 'jpeg' ? 'image/jpeg' : 'image/webp'
}

module.exports = {
  ALLOWED_HOSTS,
  SHIKIMORI_MIRRORS,
  SLOW_HOSTS,
  normalizeHostname,
  getExtraAllowedHosts,
  isAllowedHost,
  getReferer,
  isSlowHost,
  getFetchCandidates,
  decodeDataUri,
  parseImageParams,
  contentTypeForFormat,
}
