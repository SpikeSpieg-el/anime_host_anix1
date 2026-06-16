const MANGADEX_API_BASE = 'https://api.mangadex.org';

export const MANGADEX_TAGS_MAP: Record<string, string> = {
  "Экшен": "391b0423-d847-456f-aff0-8b0cfc03066b",
  "Приключения": "87cc87cd-a395-47af-b27a-93258283bbc6",
  "Комедия": "4d32cc48-9f00-4cca-9b5a-a839f0764984",
  "Драма": "b9af3a63-f058-46de-a9a0-e0c13906197a",
  "Фэнтези": "cdc58593-87dd-415e-bbc0-2ec27bf404cc",
  "Ужасы": "cdad7e68-1419-41dd-bdce-27753074a640",
  "Романтика": "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
  "Фантастика": "256c8bd9-4904-4360-bf4f-508a76d67183",
  "Повседневность": "e5301a23-ebd9-49dd-a0cb-2add944c7fe9",
  "Спорт": "69964a64-2f90-4d33-beeb-f3ed2875eb4c",
  "Триллер": "07251805-a27e-4d59-b488-f0bfbec15168",
  "Исекай": "ace04997-f6bd-436e-b261-779182193d3d",
  "Сёнэн": "81c836c9-914a-4eca-981a-560dad663e73",
  "Сэйнэн": "b1e97889-25b4-4258-b28b-cd7f4d28ea9b",
  "Сёдзё": "a3c67850-4684-404e-9b7f-c69850ee5da6",
  "Музыка": "f42fbf9e-188a-447b-9fdc-f19dc1e4d685",
  "Психология": "3b60b75c-a2d7-4860-ab56-05f391bb889c",
  "Сверхъестественное": "eabc5b4c-6aff-42f3-b657-3e90cbd00b75",
  "Исторический": "33771934-028e-4cb3-8744-691e866a923e",
  "Боевые искусства": "799c202e-7daa-44eb-9cf7-8a3c0441531e",
  "Детектив": "ee968100-4191-4968-93d3-f82d72be7e46",
  "Меха": "50880a9d-5440-4732-9afb-8f457127e836",
  "Школа": "caaa44eb-cd40-4177-b930-79d3ef2afe87",
  "Гарем": "aafb99c1-7f60-43fa-b75f-fc9502ce29c7",
  "Военное": "ac72833b-c4e9-4878-b9db-6c8a4a99444a",
  "Демоны": "39730448-9a5f-48a2-85b0-a70db87b1233",
  "Вампиры": "d7d1730f-6eb0-4ba6-9437-602cac38664c",
  "Игры": "9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8",
  "Полиция": "df33b754-73a3-4c54-80e6-1a74a8058539",
  "Самураи": "81183756-1453-4c81-aa9e-f6e1b63be016",
  "Супер сила": "7064a261-a137-4d3a-8848-2d385de3a99c",
  "Трагедия": "f8f62932-27da-4fe4-8ee1-6779a8c5edba",
  "Магия": "a1f53773-c69a-4ce5-8cab-fffcd90b1565",
  "Медицина": "c8cbe35b-1b2b-4a3f-9c37-db84c4514856",
  "Мистика": "ee968100-4191-4968-93d3-f82d72be7e46",
  "Wuxia": "acc803a4-c95a-4c22-86fc-eb6b582d82a2",
  "Школьная жизнь": "caaa44eb-cd40-4177-b930-79d3ef2afe87",
  "Путешествие во времени": "292e862b-2d17-4062-90a2-0356caa4ae27",
  "Реинкарнация": "0bc90acb-ccc1-44ca-a34a-b9f3a73259d0",
  "Зомби": "631ef465-9aba-4afb-b0fc-ea10efe274a8",
  "Призраки": "3bb26d85-09d5-4d2e-880c-c34b974339e9",
  "Ниндзя": "489dd859-9b61-4c37-af75-5b18e88daafc",
  "Кулинария": "ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869",
  "Виртуальная реальность": "8c86611e-fab7-4986-9dec-d1a2f44acdd5",
  "Монстры": "36fd93ea-e8b8-445e-b836-358f02b3d33d",
  "Выживание": "5fff9cde-849c-4d78-aab0-0d52b2ee1d25",
  "Мафия": "85daba54-a71c-4554-8a28-9901a8b0afad",
  "Офисные работники": "92d6d951-ca5e-429c-ac78-451071cbf064",
  "Хулиганы": "da2d50ca-3018-4cc0-ac7a-6b7d472a29ea",
  "Видеоигры": "9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8",
  "Традиционные игры": "31932a7e-5b8e-49a6-9f12-2afa39dc544c",
  "Махджонг": "cb562697-929f-4d28-9d66-6d3995bf2592",
  "Женские отношения": "a3c67850-4684-404e-9b7f-c69850ee5da6",
  "Мужские отношения": "5920b825-4181-4a17-beeb-9918b0ff7a30",
  "Обратный гарем": "65761a2a-415e-47f3-bef2-a9dababba7a6",
  "Перекрестное переодевание": "9ab53f92-3eed-4e9b-903a-917c86035ee3",
  "Смена пола": "2bd2e8d0-f146-434a-9b51-fc9ff2c5fe6a",
  "Гяру": "fad12b5e-68ba-460e-b933-9ae8318f5b65",
  "Злодейка": "d14322ac-4d6f-4e9b-afd9-629d5f4d8a41",
  "Девушки-монстры": "dd1f77c5-dea9-4e2b-97ae-224af09caf99",
  "Лоли": "2d1f5d56-a1e5-4d0d-a961-2193588b08ec",
  "Сёта": "ddefd648-5140-4e5f-ba18-4eca4071d19b",
  "Инцест": "5bd0e105-4481-44ca-b6e7-7544da56b1a3",
  "Постапокалипсис": "9467335a-1b83-4497-9231-765337a00b96",
  "Пришельцы": "e64f6742-c834-471d-8d72-dd51fc02b835",
  "Животные": "3de8c75d-8ee3-48ff-98ee-e20a65c86451",
  "Философский": "b1e97889-25b4-4258-b28b-cd7f4d28ea9b",
  "Преступность": "5ca48985-9a9d-4bd8-be29-80dc0303db72",
  "Антология": "51d83883-4103-437c-b4b1-731cb73d786c",
  "Ваншот": "0234a31e-a729-4e28-9d6a-3f87c4966b9e",
  "Додзинси": "b13b2a48-c720-44a9-9c77-39c9979373fb",
  "4-кома": "b11fda93-8f1d-4bef-b2ed-8803d3733170",
  "Веб-комикс": "e197df38-d0e7-43b5-9b09-2842d0c326dd",
  "Длинная полоса": "3e2b8dae-350e-4ab8-a8ce-016e844b9f0d",
  "Официальная цветная": "320831a8-4026-470b-94f6-8353740e6f04",
  "Фанатская раскраска": "7b2ce280-79ef-4c09-9b58-12b7c23a9b78",
  "Полная цветная": "f5ba408b-0e7a-484d-8d49-4e9125ac96de",
  "Самиздат": "891cf039-b895-47f0-9229-bef4c96eccd4",
  "Награжденный": "0a39b5a1-b235-4886-a747-1d05d216532d",
  "Адаптация": "f4122d1c-3b44-44d0-9936-ff7502c39ad3",
  "Насилие": "97893a4c-12af-4dac-b6be-0dffb353568e",
  "Гор": "b29d6a3d-1569-4e7a-8caf-7557bc92cd5d",
};

export const MANGADEX_TAGS_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MANGADEX_TAGS_MAP).map(([name, id]) => [id, name])
);

export interface MangaDexManga {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  year?: number;
  tags?: string[];
}

export interface MangaChapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  translatedLanguage: string;
}

async function fetchMangaDex<T>(endpoint: string, params: Record<string, string | string[]> = {}, retries: number = 3): Promise<T> {
  const url = new URL(`${MANGADEX_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(val => url.searchParams.append(key, val));
    } else if (typeof value === 'string' && value.includes(',')) {
      value.split(',').forEach(val => url.searchParams.append(key, val));
    } else {
      url.searchParams.append(key, value);
    }
  });

  console.log(`[MangaDex] Fetching: ${url.toString()}`);

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'MangaReader/1.0',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorDetails = '';
        try {
          errorDetails = await response.text();
        } catch (e) {}
        throw new Error(`MangaDex API error: ${response.status} - ${errorDetails}`);
      }

      const data = await response.json();
      console.log(`[MangaDex] Response received for ${endpoint}`);
      return data;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[MangaDex] Fetch attempt ${attempt + 1}/${retries} failed:`, error);
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  console.error(`[MangaDex] Fetch error for ${url.toString()} after ${retries} retries:`, lastError);
  throw lastError || new Error('MangaDex API: Max retries exceeded');
}

function isCyrillic(text: string): boolean {
  return /[а-яёА-ЯЁ]/i.test(text);
}

function mapMangaData(manga: any): MangaDexManga {
  let title = manga.attributes?.title?.ru;

  // 1. Try to find a Russian title in altTitles with the 'ru' language key
  if (!title && manga.attributes?.altTitles) {
    const ruAlt = manga.attributes.altTitles.find((t: any) => t.ru)?.ru;
    if (ruAlt) {
      title = ruAlt;
    }
  }

  // 2. Try to find any title containing Cyrillic characters
  if (!title && manga.attributes?.title) {
    const cyrillicTitleKey = Object.keys(manga.attributes.title).find(key => 
      isCyrillic(manga.attributes.title[key])
    );
    if (cyrillicTitleKey) {
      title = manga.attributes.title[cyrillicTitleKey];
    }
  }

  if (!title && manga.attributes?.altTitles) {
    for (const altObj of manga.attributes.altTitles) {
      const val = Object.values(altObj)[0] as string;
      if (val && isCyrillic(val)) {
        title = val;
        break;
      }
    }
  }

  // Identify the original/English title to keep as a fallback / alternative title
  const originalTitle = manga.attributes?.title?.en || 
                        manga.attributes?.title?.ja ||
                        manga.attributes?.title?.['ja-ro'] ||
                        Object.values(manga.attributes?.title || {})[0] || 
                        'Unknown';

  // 3. Fallback to original/English title if no Russian title was found
  if (!title) {
    title = originalTitle;
  }

  // Gather alternative titles
  const altTitles: string[] = [];
  
  // If we picked a Russian title, make sure the original/English title is listed in altTitles
  if (originalTitle && originalTitle !== title) {
    altTitles.push(originalTitle);
  }

  if (manga.attributes?.altTitles) {
    manga.attributes.altTitles.forEach((t: any) => {
      const vals = Object.values(t) as string[];
      vals.forEach(val => {
        if (val && val !== title && !altTitles.includes(val)) {
          altTitles.push(val);
        }
      });
    });
  }
  
  const description = manga.attributes?.description?.ru ||
                     manga.attributes?.description?.en || 
                     Object.values(manga.attributes?.description || {})[0] || '';
  
  const coverArt = manga.relationships?.find((r: any) => r.type === 'cover_art');
  const coverFilename = coverArt?.attributes?.fileName;
  const image = coverFilename 
    ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFilename}`
    : undefined;

  const tags = manga.attributes?.tags
    ?.filter((t: any) => t.type === 'tag')
    ?.map((t: any) => t.attributes?.name?.en)
    ?.filter(Boolean) || [];

  return {
    id: manga.id,
    title,
    altTitles,
    image,
    description,
    status: manga.attributes?.status,
    year: manga.attributes?.year,
    tags,
  };
}

export async function searchMangaDexByTags(tags: string[], limit: number = 20, offset: number = 0): Promise<MangaDexManga[]> {
  try {
    const params: Record<string, string | string[]> = {
      limit: limit.toString(),
      offset: offset.toString(),
      'contentRating[]': 'safe,suggestive',
      'includes[]': 'cover_art',
    };

    // Convert tag names to MangaDex tag IDs
    const tagIds = tags
      .map(tag => MANGADEX_TAGS_MAP[tag])
      .filter((id): id is string => id !== undefined);

    if (tagIds.length > 0) {
      params['includedTags[]'] = tagIds;
    }

    const response = await fetchMangaDex<{ data: any[] }>('/manga', params);

    if (!response.data || !Array.isArray(response.data)) {
      console.warn('[MangaDex] No data in tag search response');
      return [];
    }

    return response.data.map(mapMangaData);
  } catch (error) {
    console.error('[MangaDex] Error searching manga by tags:', error);
    return [];
  }
}

export async function searchMangaDex(query: string, limit: number = 20, offset: number = 0): Promise<MangaDexManga[]> {
  try {
    const response = await fetchMangaDex<{ data: any[] }>('/manga', {
      title: query,
      limit: limit.toString(),
      offset: offset.toString(),
      'contentRating[]': 'safe,suggestive',
      'includes[]': 'cover_art',
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.warn('[MangaDex] No data in search response');
      return [];
    }

    return response.data.map(mapMangaData);
  } catch (error) {
    console.error('[MangaDex] Error searching manga:', error);
    return [];
  }
}

export async function getMangaDexChapters(mangaId: string): Promise<MangaChapter[]> {
  try {
    let allChaptersData: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchMangaDex<{ data: any[]; total: number }>('/chapter', {
        'manga': mangaId,
        'translatedLanguage[]': 'ru,en',
        'order[chapter]': 'asc',
        'limit': limit.toString(),
        'offset': offset.toString(),
      });

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        break;
      }

      allChaptersData = allChaptersData.concat(response.data);
      offset += limit;

      if (allChaptersData.length >= (response.total || 0) || allChaptersData.length >= 500) {
        hasMore = false;
      }
    }

    if (allChaptersData.length === 0) {
      return [];
    }

    // Map and filter chapters that actually have pages
    const chapters: MangaChapter[] = allChaptersData
      .filter((ch: any) => ch.attributes?.chapter && ch.attributes?.pages > 0)
      .map((ch: any) => ({
        id: ch.id,
        chapter: ch.attributes.chapter,
        title: ch.attributes.title,
        pages: ch.attributes.pages,
        translatedLanguage: ch.attributes.translatedLanguage,
      }));

    // Group by chapter number, prioritizing Russian translations ('ru') over English ('en')
    const chapterMap = new Map<string, MangaChapter>();
    
    chapters.forEach(ch => {
      const existing = chapterMap.get(ch.chapter);
      if (!existing) {
        chapterMap.set(ch.chapter, ch);
      } else {
        // If the new chapter is Russian and the existing one is not, replace it
        if (ch.translatedLanguage === 'ru' && existing.translatedLanguage !== 'ru') {
          chapterMap.set(ch.chapter, ch);
        }
      }
    });

    // Sort chapters numerically by chapter number
    return Array.from(chapterMap.values()).sort((a, b) => {
      const numA = parseFloat(a.chapter);
      const numB = parseFloat(b.chapter);
      if (isNaN(numA) || isNaN(numB)) {
        return a.chapter.localeCompare(b.chapter);
      }
      return numA - numB;
    });
  } catch (error) {
    console.error('[MangaDex] Error getting chapters:', error);
    return [];
  }
}

export async function getMangaDexChapterPages(chapterId: string): Promise<string[]> {
  try {
    const response = await fetchMangaDex<{ baseUrl: string; chapter: { hash: string; data: string[] } }>(`/at-home/server/${chapterId}`);
    
    const chapterHash = response?.chapter?.hash;
    const pages = response?.chapter?.data;

    if (!chapterHash || !pages) {
      return [];
    }

    // Use stable central uploads.mangadex.org CDN instead of volunteer nodes
    return pages.map((page: string) => `https://uploads.mangadex.org/data/${chapterHash}/${page}`);
  } catch (error) {
    console.error('[MangaDex] Error getting chapter pages:', error);
    return [];
  }
}

export async function getPopularManga(limit: number = 20, offset: number = 0): Promise<MangaDexManga[]> {
  try {
    const response = await fetchMangaDex<{ data: any[] }>('/manga', {
      'order[followedCount]': 'desc',
      'limit': limit.toString(),
      'offset': offset.toString(),
      'contentRating[]': 'safe,suggestive',
      'includes[]': 'cover_art',
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.warn('[MangaDex] No data in popular manga response');
      return [];
    }

    return response.data.map(mapMangaData);
  } catch (error) {
    console.error('[MangaDex] Error getting popular manga:', error);
    return [];
  }
}

export async function getRecentManga(limit: number = 20, offset: number = 0): Promise<MangaDexManga[]> {
  try {
    const response = await fetchMangaDex<{ data: any[] }>('/manga', {
      'order[latestUploadedChapter]': 'desc',
      'limit': limit.toString(),
      'offset': offset.toString(),
      'contentRating[]': 'safe,suggestive',
      'includes[]': 'cover_art',
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.warn('[MangaDex] No data in recent manga response');
      return [];
    }

    return response.data.map(mapMangaData);
  } catch (error) {
    console.error('[MangaDex] Error getting recent manga:', error);
    return [];
  }
}

export async function getMangaDexInfo(mangaId: string): Promise<MangaDexManga | null> {
  try {
    const response = await fetchMangaDex<{ data: any }>(`/manga/${mangaId}`, {
      'includes[]': 'cover_art',
    });

    if (!response.data) {
      return null;
    }

    return mapMangaData(response.data);
  } catch (error) {
    console.error('[MangaDex] Error fetching manga info:', error);
    return null;
  }
}
