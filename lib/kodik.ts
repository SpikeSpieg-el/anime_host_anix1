import {
  getKodikToken,
  invalidateKodikToken,
  KODIK_API_URL,
} from "./kodik-token"

export interface KodikEpisode {
  id: string
  episode: number
  season: number
  title: string
  translation: {
    id: string
    title: string
  }
}

export interface KodikAnime {
  id: string
  shikimori_id: number
  title: string
  other_title: string
  episodes: number
  poster: string
  episodes_list: KodikEpisode[]
}

/**
 * Доступная озвучка (перевод) для аниме.
 * `playerLink` — прямой URL плеера Kodik для этой озвучки
 *   (вида //kodikplayer.com/serial/<id>/<hash>/720p).
 * `episodesCount` — количество доступных серий в этой озвучке.
 * `type` — 'voice' (озвучка) | 'subtitles' (субтитры).
 */
export interface KodikTranslation {
  id: string
  translationId: string
  title: string
  type: string
  quality: string
  episodesCount: number
  playerLink: string
  seasons: Record<string, KodikSeason> | undefined
}

interface KodikSeason {
  link?: string
  episodes?: Record<string, string>
}

interface KodikSearchResult {
  id: string
  type: string
  link: string
  title: string
  title_orig?: string
  other_title?: string
  translation?: { id: string; title: string; type?: string }
  episodes_count?: number
  shikimori_id?: string
  quality?: string
  seasons?: Record<string, KodikSeason>
  material_data?: {
    poster_url?: string
    anime_poster_url?: string
  }
  screenshots?: string[]
}

interface KodikSearchResponse {
  total: number
  time: string
  results: KodikSearchResult[]
  error?: string
  next_page?: string
}

/**
 * Низкоуровневый запрос к Kodik API (POST, kodik-api.com).
 * Автоматически подтягивает бесплатный токен и сбрасывает кэш токена
 * при ошибках авторизации.
 */
async function kodikRequest(
  endpoint: "search" | "list" | "translations",
  filters: Record<string, string> = {}
): Promise<KodikSearchResponse | null> {
  const token = await getKodikToken()
  if (!token) {
    console.error("Kodik API: не удалось получить токен")
    return null
  }

  const payload = new URLSearchParams({
    token,
    ...filters,
  })

  try {
    const res = await fetch(`${KODIK_API_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
      },
      body: payload.toString(),
      signal: AbortSignal.timeout?.(12000),
    })

    if (!res.ok) {
      console.error("Kodik API error:", res.status)
      return null
    }

    const data = (await res.json()) as KodikSearchResponse

    // Токен мог протухнуть — сбрасываем кэш, при следующем запросе
    // будет получен свежий.
    if (data.error === "Отсутствует или неверный токен") {
      invalidateKodikToken()
      console.error("Kodik API: токен невалиден, кэш сброшен")
      return null
    }

    if (data.error) {
      console.error("Kodik API error:", data.error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error fetching from Kodik:", error)
    return null
  }
}

/**
 * Преобразует структуру seasons из ответа Kodik в плоский список эпизодов.
 * Kodik отдаёт сезоны как объект: { "1": { episodes: { "1": "//link" } } }.
 */
function flattenEpisodes(
  seasons: Record<string, KodikSeason> | undefined,
  translation?: { id: string; title: string }
): KodikEpisode[] {
  if (!seasons) return []

  const episodes: KodikEpisode[] = []
  const tr = translation ?? { id: "", title: "" }

  for (const seasonKey of Object.keys(seasons)) {
    const season = seasons[seasonKey]
    const seasonNum = Number(seasonKey)
    if (!season?.episodes) continue

    for (const epKey of Object.keys(season.episodes)) {
      const epNum = Number(epKey)
      if (Number.isNaN(epNum)) continue
      episodes.push({
        id: `${seasonNum}-${epNum}`,
        episode: epNum,
        season: seasonNum,
        title: `Серия ${epNum}`,
        translation: tr,
      })
    }
  }

  // Сортировка по сезону и эпизоду
  episodes.sort((a, b) =>
    a.season !== b.season ? a.season - b.season : a.episode - b.episode
  )

  return episodes
}

export async function getAnimeEpisodes(
  shikimoriId: string,
  title: string
): Promise<KodikEpisode[]> {
  try {
    const data = await kodikRequest("search", {
      shikimori_id: shikimoriId,
      title,
      types: "anime,anime-serial",
      with_episodes: "true",
      limit: "1",
    })

    if (!data || !data.results || data.results.length === 0) {
      return []
    }

    const anime = data.results[0]
    return flattenEpisodes(anime.seasons, anime.translation)
  } catch (error) {
    console.error("Error fetching episodes from Kodik:", error)
    return []
  }
}

/**
 * Получить список всех доступных озвучек (переводов) для аниме.
 * Kodik отдаёт каждый перевод как отдельный результат search —
 * запрашиваем с большим limit и группируем по translation.id.
 *
 * Сортировка: озвучки (voice) сначала, затем субтитры;
 * внутри группы — по убыванию количества серий.
 */
export async function getAnimeTranslations(
  shikimoriId: string,
  title?: string
): Promise<KodikTranslation[]> {
  try {
    const filters: Record<string, string> = {
      shikimori_id: shikimoriId,
      types: "anime,anime-serial",
      with_episodes: "true",
      limit: "100",
    }
    if (title) filters.title = title

    const data = await kodikRequest("search", filters)
    if (!data || !data.results || data.results.length === 0) {
      return []
    }

    const seen = new Set<string>()
    const translations: KodikTranslation[] = []

    for (const r of data.results) {
      const tr = r.translation
      if (!tr || !tr.id) continue
      // Дедупликация по id перевода
      if (seen.has(String(tr.id))) continue
      seen.add(String(tr.id))

      translations.push({
        id: r.id,
        translationId: String(tr.id),
        title: tr.title || "Неизвестная озвучка",
        type: tr.type || "voice",
        quality: r.quality || "",
        episodesCount: r.episodes_count ?? 0,
        playerLink: r.link || "",
        seasons: r.seasons,
      })
    }

    // Озвучки (voice) — первыми, затем субтитры.
    // Внутри группы — по убыванию количества серий (более полные переводы выше).
    translations.sort((a, b) => {
      const aVoice = a.type === "voice" ? 0 : 1
      const bVoice = b.type === "voice" ? 0 : 1
      if (aVoice !== bVoice) return aVoice - bVoice
      return b.episodesCount - a.episodesCount
    })

    return translations
  } catch (error) {
    console.error("Error fetching translations from Kodik:", error)
    return []
  }
}

/**
 * Получить постер аниме из Kodik (через material_data).
 * Возвращает anime_poster_url (Shikimori) либо poster_url (Кинопоиск).
 */
export async function getKodikPoster(
  shikimoriId: string
): Promise<string | null> {
  try {
    const data = await kodikRequest("search", {
      shikimori_id: shikimoriId,
      limit: "1",
      with_material_data: "true",
    })

    if (!data || !data.results || data.results.length === 0) return null

    const md = data.results[0].material_data
    if (!md) return null

    const poster = md.anime_poster_url || md.poster_url
    if (!poster || poster.includes("missing")) return null
    return poster
  } catch {
    return null
  }
}

export function getKodikPlayerUrl(
  shikimoriId: string,
  title: string,
  episode?: number
): string {
  const baseUrl = "//kodik.cc/find-player"
  const params = new URLSearchParams({
    shikimoriID: shikimoriId,
    title: title,
    types: "anime,anime-serial",
    block_blocked_countries: "true",
    no_ads: "true",
    no_provider_ads: "true",
    hide_selectors: "true",
  })

  if (episode && episode > 0) {
    params.append("episode", String(episode))
  }

  return `${baseUrl}?${params.toString()}`
}
