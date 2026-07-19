import { shikimoriJson } from "./shikimori/client"
import { BASE_URL, HEADERS } from "./shikimori/config"
import { upgradeShikimoriUrl } from "./shikimori/utils"

export interface DynamicBannerCharacter {
  characterId: number
  characterName: string
  imageUrl: string
  originalUrl: string
  isMainCharacter: boolean
  animeId: number
  animeName: string
  animeScore: number
}

export interface DynamicBannerContent {
  featuredAnimeId: number
  featuredAnimeName: string
  featuredAnimeRussianName: string
  featuredAnimePosterUrl: string
  featuredAnimeScore: number
  ongoingAnimeIds: number[]
  guaranteedCharacters: DynamicBannerCharacter[]
  rotationIndex: number
  rotationStart: string
  rotationEnd: string
}

interface ShikimoriOngoingAnime {
  id: number
  name: string
  russian: string
  score: string
  image: { original: string }
  rating: string
  kind: string
  status: string
}

interface ShikimoriRole {
  character: {
    id: number
    name: string
    russian: string
    image: { original: string; preview: string }
  }
  roles: string[]
  roles_russian: string[]
  roles_ru: string[]
}

const ROTATION_DAYS = 3
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

let cachedContent: DynamicBannerContent | null = null
let cachedAt = 0

function getRotationIndex(totalAnimes: number): { index: number; rotationStart: string; rotationEnd: string } {
  const now = new Date()
  const epochDays = Math.floor(now.getTime() / (1000 * 60 * 60 * 24))
  const rotationPeriod = Math.floor(epochDays / ROTATION_DAYS)
  const index = rotationPeriod % totalAnimes
  const rotationStart = new Date(rotationPeriod * ROTATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const rotationEnd = new Date((rotationPeriod + 1) * ROTATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  return { index, rotationStart, rotationEnd }
}

export async function resolveDynamicBanner(): Promise<DynamicBannerContent | null> {
  if (cachedContent && Date.now() - cachedAt < CACHE_TTL) {
    return cachedContent
  }

  try {
    const ongoingData = await shikimoriJson<ShikimoriOngoingAnime[]>(
      `${BASE_URL}/animes?limit=30&status=ongoing&order=ranked&score=6`,
      { next: { revalidate: 1800 }, headers: HEADERS },
      { fallback: [] }
    )

    const safeAnimes = ongoingData.filter(a => {
      if (a.rating === 'rx' || a.rating === 'x' || a.rating === 'r_plus') return false
      if (a.kind === 'Special' || a.kind === 'OVA' || a.kind === 'ONA') return false
      return true
    })

    if (safeAnimes.length === 0) return null

    const allOngoingIds = safeAnimes.map(a => a.id)

    const { index, rotationStart, rotationEnd } = getRotationIndex(safeAnimes.length)
    const selectedAnime = safeAnimes[index]

    const rolesData = await shikimoriJson<ShikimoriRole[]>(
      `${BASE_URL}/animes/${selectedAnime.id}/roles`,
      { next: { revalidate: 3600 }, headers: HEADERS },
      { fallback: [] }
    )

    const mainRoles = rolesData.filter(r => {
      if (!r.character || !r.character.id) return false
      if (r.character.image?.original?.includes('missing')) return false
      return (r.roles || []).includes('Main') || (r.roles_russian || []).includes('Главный') || (r.roles_ru || []).includes('Главный')
    })

    if (mainRoles.length === 0) {
      const nextIndex = (index + 1) % safeAnimes.length
      const fallbackAnime = safeAnimes[nextIndex]
      const fallbackRoles = await shikimoriJson<ShikimoriRole[]>(
        `${BASE_URL}/animes/${fallbackAnime.id}/roles`,
        { next: { revalidate: 3600 }, headers: HEADERS },
        { fallback: [] }
      )
      const fallbackMain = fallbackRoles.filter(r => {
        if (!r.character || !r.character.id) return false
        if (r.character.image?.original?.includes('missing')) return false
        return (r.roles || []).includes('Main') || (r.roles_russian || []).includes('Главный') || (r.roles_ru || []).includes('Главный')
      })
      if (fallbackMain.length === 0) return null
      const content = buildContent(fallbackAnime, fallbackMain, allOngoingIds, nextIndex, rotationStart, rotationEnd)
      cachedContent = content
      cachedAt = Date.now()
      return content
    }

    const content = buildContent(selectedAnime, mainRoles, allOngoingIds, index, rotationStart, rotationEnd)
    cachedContent = content
    cachedAt = Date.now()
    return content
  } catch (error) {
    console.error('[resolveDynamicBanner] Error:', error)
    return null
  }
}

function buildContent(
  featuredAnime: ShikimoriOngoingAnime,
  mainRoles: ShikimoriRole[],
  allOngoingIds: number[],
  rotationIndex: number,
  rotationStart: string,
  rotationEnd: string
): DynamicBannerContent {
  const animePosterUrl = upgradeShikimoriUrl(featuredAnime.image?.original || '')
  const animeScore = parseFloat(featuredAnime.score || "0")

  const guaranteedCharacters: DynamicBannerCharacter[] = mainRoles.slice(0, 3).map(role => {
    const char = role.character
    const originalUrl = char.image.original.startsWith("/")
      ? `https://shikimori.one${char.image.original}`
      : char.image.original

    return {
      characterId: char.id,
      characterName: char.russian || char.name,
      imageUrl: originalUrl,
      originalUrl,
      isMainCharacter: true,
      animeId: featuredAnime.id,
      animeName: featuredAnime.russian || featuredAnime.name,
      animeScore,
    }
  })

  return {
    featuredAnimeId: featuredAnime.id,
    featuredAnimeName: featuredAnime.name,
    featuredAnimeRussianName: featuredAnime.russian || featuredAnime.name,
    featuredAnimePosterUrl: animePosterUrl,
    featuredAnimeScore: animeScore,
    ongoingAnimeIds: allOngoingIds,
    guaranteedCharacters,
    rotationIndex,
    rotationStart,
    rotationEnd,
  }
}

export function dynamicBannerToCardPayload(char: DynamicBannerCharacter, rarity: string = 'epic'): any {
  return {
    id: 0,
    characterId: char.characterId,
    characterName: char.characterName,
    name: char.characterName,
    anime: char.animeName,
    animeName: char.animeName,
    rarity,
    imageUrl: char.imageUrl,
    originalUrl: char.originalUrl,
    shikiId: char.animeId,
    isMainCharacter: true,
    stats: {
      hp: Math.floor(Math.random() * 30) + 40,
      atk: Math.floor(Math.random() * 30) + 40,
      def: Math.floor(Math.random() * 30) + 40,
      spd: Math.floor(Math.random() * 30) + 40,
      luck: Math.floor(Math.random() * 30) + 40,
    },
  }
}
