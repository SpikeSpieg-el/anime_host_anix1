// Кастомный next/image loader для продакшена: вместо /_next/image ходим
// в отдельный контейнер с img-оптимизатором (coolify-image-service).
//
// ВАЖНО: сервис умеет.fetch только абсолютный http(s)-URL из своего белого
// списка хостов. Всё, что ему скормить нельзя, надо вернуть КАК ЕСТЬ — иначе
// next/image получит 502 и обложка просто исчезнет. Именно отсюда бралась
// «часть обложек не грузится» при живом и healthy контейнере.
const IMAGE_SERVER_URL = (process.env.NEXT_PUBLIC_IMAGE_SERVER_URL || '').replace(/\/+$/, '')

function bypassImageService(src) {
  if (!src) return true
  // Локальные файлы (/catgirl_tutorial.png, /icon.svg).
  if (src.startsWith('/') && !src.startsWith('//')) return true
  // Сгенерированные обложки-заглушки и предпросмотр загрузки.
  if (/^(data|blob):/i.test(src)) return true
  // Свои загрузки в Supabase Storage: белый список img-сервиса их
  // намеренно не содержит, грузим напрямую.
  if (/\.supabase\.co\/storage\//i.test(src)) return true
  // Уже обёрнутый адрес img-сервиса (в т.ч. старый :8443).
  if (IMAGE_SERVER_URL && isSameImageService(src)) return true
  // Прочие схемы/относительные адреса сервис всё равно не поймёт.
  return !/^https?:\/\//i.test(src)
}

function isSameImageService(src) {
  try {
    const parsed = new URL(src)
    const server = new URL(IMAGE_SERVER_URL)
    return parsed.hostname === server.hostname &&
      (parsed.pathname === '/proxy' || parsed.pathname === '/optimize')
  } catch {
    return src.startsWith(IMAGE_SERVER_URL)
  }
}

function coolifyImageLoader({ src, width, quality }) {
  if (!src) return src

  // Если сервер не задан, работаем стандартным оптимизатором Next.js.
  if (!IMAGE_SERVER_URL) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 60}`
  }

  // Protocol-relative ссылки нормализуем, чтобы не потерять Referer прокси.
  const normalized = src.startsWith('//') ? `https:${src}` : src
  if (bypassImageService(normalized)) return normalized

  return `${IMAGE_SERVER_URL}/optimize?url=${encodeURIComponent(normalized)}&w=${width}&q=${quality || 60}&f=webp`
}

module.exports = coolifyImageLoader
// Экспортируем helper'ы для юнит-тестов, не меняя основной CommonJS-экспорт.
module.exports.bypassImageService = bypassImageService
module.exports.isSameImageService = isSameImageService
