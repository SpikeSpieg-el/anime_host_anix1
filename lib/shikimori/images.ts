import { upgradeShikimoriUrl, generateArtPoster, normalizeShikimoriUrl } from "./utils";
import { shikimoriFetch, shikimoriJson } from "./client";
import { BASE_URL } from "./config";

function isHighQualityImage(url: string, isPoster: boolean = true): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  if (['missing', 'stub', 'placeholder', 'default'].some(s => lowerUrl.includes(s))) return false;
  if (['x96', 'x48', 'x160'].some(s => lowerUrl.includes(s))) return false;
  if (isPoster) return true;
  if (['preview', 'thumb', 'thumbnail', 'small'].some(s => lowerUrl.includes(s))) return false;
  const sizeMatch = url.match(/(\d+)x(\d+)/);
  if (sizeMatch && parseInt(sizeMatch[1]) < 800) return false;
  return true;
}

export async function resolveBestPoster(shikimoriUrl: string, romajiName: string, russianName: string, shikimoriId: string): Promise<string> {
  const targetName = russianName || romajiName || "Anime";
  
  const upgradedUrl = upgradeShikimoriUrl(shikimoriUrl);
  if (isHighQualityImage(upgradedUrl, true)) return upgradedUrl;

  // Попробуем другие источники (Kodik, Anilist, MAL)
  const namesToTry = [romajiName, russianName].filter(Boolean);
  
  const kodik = await getKodikPoster(shikimoriId);
  if (kodik) return kodik;

  for (const name of namesToTry) {
    const anilist = await getAnilistPoster(name);
    if (anilist) return anilist;
    const mal = await getMyAnimeListPoster(name);
    if (mal) return mal;
  }

  return generateArtPoster(targetName);
}

async function getKodikPoster(shikimoriId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://kodikapi.com/v2/animes?shikimori_id=${shikimoriId}&limit=1`);
    if (!response.ok) return null;
    const json = await response.json();
    const poster = json.results?.[0]?.poster || json.results?.[0]?.poster_url;
    return (poster && !poster.includes('missing')) ? poster : null;
  } catch { return null; }
}

async function getAnilistPoster(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { coverImage { extraLarge large } } }`,
        variables: { search: searchTitle }
      }),
      next: { revalidate: 86400 }
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json?.data?.Media?.coverImage?.extraLarge || json?.data?.Media?.coverImage?.large || null;
  } catch { return null; }
}

async function getMyAnimeListPoster(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTitle)}&limit=1`, { next: { revalidate: 86400 } });
    if (!response.ok) return null;
    const json = await response.json();
    return json.data?.[0]?.images?.jpg?.large_url || null;
  } catch { return null; }
}

export async function getAnimeBackdrop(shikimoriId: string): Promise<string | null> {
  try {
    // 1. Screenshots
    const res = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}/screenshots`);
    if (res.ok) {
      const data: any[] = await res.json();
      const best = data?.find(s => isHighQualityImage(normalizeShikimoriUrl(s.original), false));
      if (best) return normalizeShikimoriUrl(best.original);
    }
    // 2. Anilist Banner
    const animeRes = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}`);
    if (animeRes.ok) {
      const data = await animeRes.json();
      const anilistBanner = await getAnilistBackdrop(data.name);
      if (anilistBanner) return anilistBanner;
    }
    return null;
  } catch { return null; }
}

async function getAnilistBackdrop(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { bannerImage coverImage { extraLarge } } }`,
        variables: { search: searchTitle }
      }),
      next: { revalidate: 86400 }
    });
    const json = await response.json();
    return json?.data?.Media?.bannerImage || json?.data?.Media?.coverImage?.extraLarge || null;
  } catch { return null; }
}