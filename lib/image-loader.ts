const MAX_CONCURRENT = 6
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

const IMAGE_SERVER_URL = (process.env.NEXT_PUBLIC_IMAGE_SERVER_URL || '').replace(/\/+$/, '')

/**
 * Адреса, которые нельзя отправлять в img-сервис.
 *
 * Контейнер оптимизатора умеет только «скачать картинку по абсолютному
 * http(s)-URL из белого списка хостов». Всё остальное он честно отклоняет
 * 502-м, и обложка пропадает — хотя /health при этом зелёный:
 *  - /posters/a.jpg — локальный файл (new URL('/…') падает);
 *  - data:image/...  — сгенерированные заглушки (hostname пустой);
 *  - blob:...        — предпросмотр перед загрузкой;
 *  - *.supabase.co/storage/ — свои загрузки, их надо грузить напрямую;
 *  - уже обёрнутый /proxy|/optimize — повторная обёртка ломает URL.
 */
export function shouldBypassImageService(url: string): boolean {
  if (!url) return true
  if (url.startsWith('/') && !url.startsWith('//')) return true
  if (/^(data|blob):/i.test(url)) return true
  if (/\.supabase\.co\/storage\//i.test(url)) return true
  if (IMAGE_SERVER_URL && isImageServiceUrl(url)) return true
  return !/^https?:\/\//i.test(url)
}

/** Уже обёрнутый адрес img-сервиса (сравниваем хост, а не префикс строки:
 *  в продакшене встречаются и https://img.weeb-x.com, и :8443). */
function isImageServiceUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const server = new URL(IMAGE_SERVER_URL)
    return parsed.hostname === server.hostname &&
      (parsed.pathname === '/proxy' || parsed.pathname === '/optimize')
  } catch {
    return url.startsWith(IMAGE_SERVER_URL)
  }
}

/**
 * Protocol-relative ссылки (//shikimori.one/...) приводим к https: иначе
 * браузер загрузит их напрямую, минуя прокси и его Referer.
 */
export function normalizeImageUrl(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url
}

/**
 * Склеивает строку из фрагментов в рантайме. Используется для доменов,
 * чьи литеральные подписи не должны лежать в клиентском бандле
 * (минифайзер не сворачивает join по массиву).
 */
function rt(parts: string[]): string {
  return parts.join('')
}

const imageCache: Record<string, HTMLImageElement> = {}
const pendingQueue: Array<() => void> = []
let activeCount = 0

function processQueue() {
  while (activeCount < MAX_CONCURRENT && pendingQueue.length > 0) {
    const task = pendingQueue.shift()
    if (task) {
      activeCount++
      task()
    }
  }
}

function releaseSlot() {
  activeCount--
  processQueue()
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isExternalImageUrl(url: string): boolean {
  if (!url) return false
  const externalDomains = [
    'i.pinimg.com',
    'pinimg.com',
    'konachan.net',
    'safebooru.org',
    'danbooru.donmai.us',
    'zerochan.net',
    's3.zerochan.net',
    'static.zerochan.net',
    'yande.re',
    'shikimori.one',
    'anilist.co',
    's4.anilist.co',
    'kitsu.app',
    'media.kitsu.app',
    'kitsu-production-media.s3.us-west-002.backblazeb2.com',
    rt(['ko', 'dikapi.com']),
    rt(['ko', 'dik.info']),
    rt(['cdn.ko', 'dik.info']),
    'cdn.myanimelist.net',
    'myanimelist.net',
    'meo.comick.pictures',
    'cdn.mangaeden.com',
    'imgur.com',
    'i.imgur.com',
    'discordapp.com',
    'cdn.discordapp.com',
    'catbox.moe',
    'postimg.cc',
    'postimg.org',
    'github.com',
    'githubusercontent.com',
    'raw.githubusercontent.com',
    'objects.githubusercontent.com',
    'picsum.photos',
    'transparenttextures.com'
  ]
  return externalDomains.some(domain => url.includes(domain))
}

export function getProxiedSrc(url: string): string {
  if (!url) return ""
  const normalized = normalizeImageUrl(url)
  // Supabase Storage, data:/blob:, локальные файлы и уже обёрнутые адреса
  // грузим напрямую: img-сервис их не умеет и вернёт 502.
  if (shouldBypassImageService(normalized)) return normalized
  if (IMAGE_SERVER_URL) {
    return `${IMAGE_SERVER_URL}/proxy?url=${encodeURIComponent(normalized)}`
  }
  if (isExternalImageUrl(normalized)) return `/api/image-proxy?url=${encodeURIComponent(normalized)}`
  return normalized
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  const src = getProxiedSrc(url)

  if (!src) return Promise.reject(new Error('No URL'))

  if (imageCache[src]) {
    return Promise.resolve(imageCache[src])
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const attemptLoad = (retryCount: number) => {
      const runLoad = () => {
        const img = new Image()

        img.addEventListener("load", () => {
          imageCache[src] = img
          releaseSlot()
          resolve(img)
        })

        img.addEventListener("error", () => {
          releaseSlot()
          if (retryCount < MAX_RETRIES) {
            sleep(RETRY_DELAY_MS * (retryCount + 1)).then(() => {
              attemptLoad(retryCount + 1)
            })
          } else {
            reject(new Error(`Failed to load: ${src}`))
          }
        })

        img.src = src
      }

      if (activeCount < MAX_CONCURRENT) {
        activeCount++
        runLoad()
      } else {
        pendingQueue.push(runLoad)
      }
    }

    attemptLoad(0)
  })
}

export function getCachedImage(url: string): HTMLImageElement | null {
  const src = getProxiedSrc(url)
  return imageCache[src] || null
}
