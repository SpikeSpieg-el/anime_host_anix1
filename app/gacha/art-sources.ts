/**
 * МНОЖЕСТВЕННЫЕ ИСТОЧНИКИ АРТОВ
 * Поддержка Safebooru, Danbooru, Gelbooru, Yande.re, Konachan
 */

const RARITY_ORDER = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

/**
 * УТИЛИТЫ ОЧИСТКИ И ФОРМАТИРОВАНИЯ
 */

// Умная генерация тегов персонажа (поддержка японских имен и транслитерации)
function getCharacterTags(name: string): string[] {
  // Берем только английскую часть, если есть слэш (на Шикимори формат "Штарк / Stark")
  const engName = name.includes('/') ? name.split('/')[1] : name;

  // Очищаем от скобок и оставляем ТОЛЬКО латинские буквы
  const clean = engName.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);

  const tags = [];
  if (parts.length >= 2) {
    tags.push(`${parts[0]}_${parts[1]}`); // Stark_Frieren (если так введено)
    tags.push(`${parts[1]}_${parts[0]}`); // Фамилия_Имя (чаще всего на Booru)
    tags.push(parts[0]);
  } else if (parts.length === 1 && parts[0]) {
    tags.push(parts[0]);
  }

  // Если теги не сгенерировались (например, из-за русского имени), пробуем маппинги
  if (tags.length === 0) {
    const nameMappings: Record<string, string[]> = {
      'рюко матой': ['ryuko_matoi', 'matoi_ryuko'],
      'сацуки кирюин': ['satsuki_kiryuin', 'kiryuin_satsuki'],
      'мако манканшок': ['mako_mankanshoku', 'mankanshoku_mako'],
      'аикуро микисуги': ['aikuro_mikisugi', 'mikisugi_aikuro'],
      'узумаки наруто': ['naruto_uzumaki', 'uzumaki_naruto'],
      'учиха саске': ['sasuke_uchiha', 'uchiha_sasuke'],
      'харуно сакура': ['sakura_haruno', 'haruno_sakura'],
      'эрен егер': ['eren_yeager', 'yeager_eren'],
      'микаса аккерман': ['mikasa_ackerman', 'ackerman_mikasa'],
      'армин арлерт': ['armin_arlert', 'arlert_armin']
    };

    const lowerName = name.toLowerCase();
    for (const [key, values] of Object.entries(nameMappings)) {
      if (lowerName.includes(key)) {
        tags.push(...values);
        break;
      }
    }
  }

  return tags;
}

// Очистка названия франшизы для поиска тега серии
function getCopyrightTag(animeName: string): string {
  const engName = animeName.includes('/') ? animeName.split('/')[1] : animeName;
  const clean = engName.toLowerCase().split(':')[0].replace(/[^a-z0-9\s]/g, ' ').trim();

  const mapping: Record<string, string> = {
    'naruto': 'naruto',
    'one piece': 'one_piece',
    'bleach': 'bleach',
    'attack on titan': 'shingeki_no_kyojin',
    'shingeki no kyojin': 'shingeki_no_kyojin',
    'demon slayer': 'kimetsu_no_yaiba',
    'kimetsu no yaiba': 'kimetsu_no_yaiba',
    'frieren': 'sousou_no_frieren',
    'sousou no frieren': 'sousou_no_frieren',
    'jujutsu kaisen': 'jujutsu_kaisen',
    'my hero academia': 'boku_no_hero_academia',
    'boku no hero': 'boku_no_hero_academia',
    'chainsaw man': 'chainsaw_man',
    'evangelion': 'neon_genesis_evangelion',
    'fullmetal alchemist': 'fullmetal_alchemist',
    'death note': 'death_note',
    'code geass': 'code_geass',
    'steins gate': 'steins_gate',
    'tokyo ghoul': 'tokyo_ghoul',
    'hunter x hunter': 'hunter_x_hunter',
    'fate': 'fate_stay_night',
    're zero': 're_zero_kara_hajimeru_isekai_seikatsu',
    'sword art online': 'sword_art_online',
    'gintama': 'gintama',
    'konosuba': 'kono_subarashii_sekai_ni_shukufuku_wo',
    'mushoku tensei': 'mushoku_tensei',
    'one punch man': 'one_punch_man',
    'jojo': 'jojos_bizarre_adventure',
    'kill la kill': 'kill_la_kill',
    'убей или умри': 'kill_la_kill'
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (clean.includes(key)) return value;
  }
  return clean.replace(/\s+/g, '_');
}

/**
 * ПОИСК АРТОВ НА РАЗНЫХ ИСТОЧНИКАХ
 */
async function fetchFromSource(source: string, tags: string, limit: number = 20): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    switch (source) {
      case 'safebooru': {
        // Safebooru - добавляем тег rating:safe для гарантии SFW контента
        const safeTags = `${tags} rating:safe`;
        const res = await fetch(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(safeTags)}&limit=${limit}`);
        if (res.ok) {
          const text = await res.text();
          if (text.trim()) {
            try {
              const data = JSON.parse(text);
              if (Array.isArray(data)) {
                data.forEach((p: any) => {
                  if (p.directory && p.image) {
                    urls.push(`https://safebooru.org/images/${p.directory}/${p.image}`);
                  }
                });
              }
            } catch (e) {
              console.log(`[Safebooru] JSON parse error:`, e);
            }
          }
        }
        break;
      }
      
      case 'danbooru': {
        // Danbooru - добавляем теги для SFW контента
        const safeTags = `${tags} rating:safe`;
        const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(safeTags)}&limit=${limit}&order=score`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((p: any) => {
              const url = p.large_file_url || p.file_url;
              if (url) urls.push(url);
            });
          }
        }
        break;
      }
      
      case 'gelbooru': {
        // Gelbooru - добавляем теги для SFW контента
        const safeTags = `${tags} rating:safe`;
        const res = await fetch(`https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(safeTags)}&limit=${limit}`);
        if (res.ok) {
          const text = await res.text();
          if (text.trim()) {
            try {
              const data = JSON.parse(text);
              if (data?.post) {
                (data.post as any[]).forEach((p: any) => {
                  if (p.file_url) urls.push(p.file_url);
                });
              }
            } catch (e) {
              console.log(`[Gelbooru] JSON parse error:`, e);
            }
          }
        }
        break;
      }
      
      case 'yande.re': {
        // Yande.re - добавляем тег rating:safe (хотя этот источник более рискованный)
        const safeTags = `${tags} rating:safe`;
        const res = await fetch(`https://yande.re/post.json?tags=${encodeURIComponent(safeTags)}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((p: any) => {
              if (p.file_url) urls.push(p.file_url);
            });
          }
        }
        break;
      }
      
      case 'konachan': {
        // Konachan - добавляем тег rating:safe
        const safeTags = `${tags} rating:safe`;
        const res = await fetch(`https://konachan.com/post.json?tags=${encodeURIComponent(safeTags)}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((p: any) => {
              if (p.file_url) urls.push(p.file_url);
            });
          }
        }
        break;
      }
    }
  } catch (e) {
    console.log(`[${source}] Fetch error:`, e);
  }
  
  return urls;
}

const characterArtCache = new Map<string, { pool: string[]; expanded: boolean }>();

/**
 * ПОЛУЧЕНИЕ АРТА С ВОЗМОЖНОСТЬЮ РАСШИРЕНИЯ ПУЛА
 * @param expandPool - если true, добавляет +30 картинок с разных источников
 */
export async function fetchHighQualityArt(
  characterName: string, 
  animeName: string, 
  ignoredUrls: string[],
  expandPool: boolean = false  // Если true — добавляем +30 картинок
): Promise<string | null> {
  const charTags = getCharacterTags(characterName);
  const seriesTag = getCopyrightTag(animeName);
  console.log(`[Art Search] Character: ${characterName}, Generated tags: [${charTags.join(', ')}], Series tag: ${seriesTag}`);
  if (charTags.length === 0) return null;

  const cacheKey = `${charTags[0]}_${seriesTag}`;
  const cached = characterArtCache.get(cacheKey);
  let pool: string[] = cached?.pool || [];

  // Проверяем, сколько артов забанено
  const ignoredCount = pool.filter(url => ignoredUrls.includes(url)).length;
  const availableCount = pool.length - ignoredCount;

  // Расширяем пул если:
  // 1. Пул пустой
  // 2. Забанено >50% артов
  // 3. Явный запрос на расширение (expandPool=true)
  // 4. Доступно <5 артов
  const shouldExpand = 
    pool.length === 0 || 
    ignoredCount > pool.length * 0.5 || 
    expandPool ||
    availableCount < 5;
  
  if (shouldExpand) {
    console.log(`[Art Search] Expanding pool: current=${pool.length}, ignored=${ignoredCount}, available=${availableCount}, expandPool=${expandPool}`);
    
    // Пробуем разные комбинации тегов
    const tagCombinations = [
      seriesTag + ' ' + charTags[0],  // Аниме + персонаж
      charTags[0],                    // Только персонаж
      seriesTag,                      // Только аниме
    ];

    if (charTags.length > 1) {
      tagCombinations.push(seriesTag + ' ' + charTags[1]);
      tagCombinations.push(charTags[1]);
    }

    // Источники для поиска (от безопасных к более рискованным)
    const sources = ['safebooru', 'danbooru', 'gelbooru', 'yande.re', 'konachan'];
    
    const newUrls: string[] = [];
    const targetCount = expandPool ? 50 : 20;  // Цель по количеству новых артов
    
    for (const tags of tagCombinations) {
      for (const source of sources) {
        console.log(`[Art Search] Searching ${source} with tags: ${tags}`);
        const urls = await fetchFromSource(source, tags, 30);
        console.log(`[Art Search] ${source} returned ${urls.length} urls`);
        
        // Добавляем только уникальные URL
        urls.forEach(url => {
          if (!newUrls.includes(url) && !pool.includes(url)) {
            newUrls.push(url);
          }
        });
        
        // Если набрали достаточно, прекращаем
        if (newUrls.length >= targetCount) break;
      }
      
      if (newUrls.length >= targetCount) break;
    }
    
    // Добавляем новые URL в пул
    pool = [...pool, ...newUrls];
    console.log(`[Art Search] New pool size: ${pool.length} (+${newUrls.length})`);
  }

  characterArtCache.set(cacheKey, { pool, expanded: cached?.expanded || expandPool });

  const filteredPool = pool.filter(url => !ignoredUrls.includes(url));
  console.log(`[Art Search] Filtered pool: ${filteredPool.length} available (${ignoredUrls.length} banned)`);
  
  if (filteredPool.length > 0) {
    // Выбираем случайный арт из ВСЕГО доступного пула
    return filteredPool[Math.floor(Math.random() * filteredPool.length)];
  }
  
  console.log(`[Art Search] No available art found, returning null`);
  return null;
}

/**
 * Получить количество доступных артов для персонажа
 */
export function getAvailableArtCount(characterName: string, animeName: string, ignoredUrls: string[]): number {
  const charTags = getCharacterTags(characterName);
  const seriesTag = getCopyrightTag(animeName);
  const cacheKey = `${charTags[0]}_${seriesTag}`;
  const cached = characterArtCache.get(cacheKey);
  
  if (!cached) return 0;
  
  return cached.pool.filter(url => !ignoredUrls.includes(url)).length;
}

/**
 * Очистить кэш артов для персонажа
 */
export function clearArtCache(characterName: string, animeName: string): void {
  const charTags = getCharacterTags(characterName);
  const seriesTag = getCopyrightTag(animeName);
  const cacheKey = `${charTags[0]}_${seriesTag}`;
  characterArtCache.delete(cacheKey);
}
