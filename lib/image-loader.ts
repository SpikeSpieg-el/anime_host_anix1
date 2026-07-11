const MAX_CONCURRENT = 6
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

const IMAGE_SERVER_URL = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL || ''

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
    'kodikapi.com',
    'kodik.info',
    'cdn.kodik.info',
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
    'raw.githubusercontent.com'
  ]
  return externalDomains.some(domain => url.includes(domain))
}

export function getProxiedSrc(url: string): string {
  if (!url) return ""
  if (IMAGE_SERVER_URL) {
    return `${IMAGE_SERVER_URL}/proxy?url=${encodeURIComponent(url)}`
  }
  if (isExternalImageUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`
  return url
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
