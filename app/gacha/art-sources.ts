
/**
 * INFINITE ART ENGINE V4 - SMART TAGS & FALLBACKS
 */

function getCharacterTags(name: string): string[] {
  // Имя обычно приходит как "Японское / Английское"
  const engName = name.includes('/') ? name.split('/')[1] : name;
  // Убираем всё в скобках и переводим в нижний регистр
  const cleanName = engName.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  
  const parts = cleanName.split(/\s+/);
  const tags: string[] =[];

  // 1. Прямой порядок (например: frieren, naruto_uzumaki)
  tags.push(parts.join('_'));

  // 2. Обратный порядок (японский формат: uzumaki_naruto, shirogane_miyuki)
  // В 90% случаев Danbooru и Safebooru используют именно этот формат!
  if (parts.length === 2) {
    tags.push(`${parts[1]}_${parts[0]}`);
  }

  // 3. Только имя (часто используется для уникальных имен: killua, nanachi)
  if (parts.length > 1) {
    tags.push(parts[0]);
  }

  return [...new Set(tags)];
}

async function fetchFromSource(source: string, tag: string, deepSearch: boolean): Promise<string[]> {
  const urls: string[] =[];
  const limit = 20; // Уменьшенный лимит для скорости
  
  // Далеко по страницам не прыгаем, чтобы не получать пустые ответы от API
  const page = deepSearch ? Math.floor(Math.random() * 3) + 1 : 1;

  // Имитируем нормального клиента, иначе API банят за спам
  const headers = {
    'User-Agent': 'WeebX-Gacha-App/1.0 (Contact: admin@example.com)'
  };

  try {
    if (source === 'safebooru') {
      const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=${limit}&pid=${page}`;
      const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(p => {
            if (p.directory && p.image) urls.push(`https://safebooru.org/images/${p.directory}/${p.image}`);
          });
        }
      }
    } 
    else if (source === 'danbooru') {
      // Ищем только безопасные арты (rating:g)
      const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}+rating:g&limit=${limit}&page=${page}`;
      const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(p => { 
            if (p.file_url) urls.push(p.file_url); 
            else if (p.large_file_url) urls.push(p.large_file_url);
          });
        }
      }
    }
  } catch (e) {
    // Ошибки таймаута просто проглатываем, чтобы не засорять консоль
  }
  return urls;
}

const characterArtCache = new Map<string, { pool: string[] }>();

export async function fetchHighQualityArt(
  characterName: string, 
  ignoredUrls: string[],
  forceNew: boolean = false
): Promise<string | null> {
  const cacheKey = characterName;
  const tags = getCharacterTags(characterName);

  let entry = characterArtCache.get(cacheKey);
  let pool = entry?.pool ||[];
  
  // CRITICAL: Always filter the entire pool against current ignoredUrls
  // This ensures banned URLs are removed from cache as well
  let filteredPool = pool.filter(url => !ignoredUrls.includes(url));
  
  // IMPORTANT: Update the cache immediately to remove banned URLs permanently
  if (filteredPool.length !== pool.length) {
    characterArtCache.set(cacheKey, { pool: filteredPool });
  }

  if (filteredPool.length < 3) {
    console.log(`[Art Engine] Searching fanart for ${characterName}...`);
    const newBatch: string[] =[];
    
    // Перебираем теги. Как только один сработал, останавливаемся
    for (const tag of tags) {
      for (const source of ['danbooru', 'safebooru']) {
        const batch = await fetchFromSource(source, tag, forceNew);
        if (batch.length > 0) {
          batch.forEach(url => {
            if (!ignoredUrls.includes(url) && !newBatch.includes(url)) {
              newBatch.push(url);
            }
          });
        }
        // Нашли пачку артов - хватит спамить запросы
        if (newBatch.length > 5) break;
      }
      if (newBatch.length > 5) break;
    }

    if (newBatch.length === 0) {
      return null;
    }
    
    filteredPool = newBatch.sort(() => Math.random() - 0.5);
  }

  const selected = filteredPool[0] || null;
  if (selected) {
    // IMPORTANT: Cache the REMAINING filtered pool, not the original pool
    // This ensures banned URLs don't persist in cache
    characterArtCache.set(cacheKey, { pool: filteredPool.slice(1) });
  }
  return selected;
}
