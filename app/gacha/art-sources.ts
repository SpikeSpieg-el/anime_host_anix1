/**
 * INFINITE ART ENGINE V5.4 - INFINITE EXPLORER MODE
 */

export interface ArtResult {
  url: string;
  source: string;
  tag: string;
}

interface CacheEntry {
  pool: ArtResult[];
  pages: Record<string, number>;
  returnedUrls: Set<string>; // Track URLs already returned to client
}

const characterArtCache = new Map<string, CacheEntry>();

function getCharacterTags(name: string, animeName?: string): { booru: string[], zerochan: string[] } {
  const engName = name.includes('/') ? name.split('/')[1] : name;
  const cleanName = engName.replace(/\([^)]*\)/g, '').trim();
  const parts = cleanName.toLowerCase().split(/\s+/);
  
  const booru: string[] = [];
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];
    booru.push(`${lastName}_${firstName}`); 
    booru.push(parts.join('_')); 
  } else {
    booru.push(parts[0]);
  }

  // Если есть название аниме, добавляем его как префикс для уточнения (например jujutsu_kaisen)
  if (animeName) {
    // Очищаем и форматируем название аниме для тегов (например "Jujutsu Kaisen" -> "jujutsu_kaisen")
    let cleanAnime = animeName.replace(/\([^)]*\)/g, '').trim();
    
    // Специальная обработка для разных форматов аниме
    cleanAnime = cleanAnime
      .replace(/\s+(Movie|Film|movie|film)/gi, '') // Удаляем слова Movie/Film
      .replace(/\s+(Part|Season|S)\s*\d+/gi, '') // Удаляем Part/Season номера
      .replace(/\s+\d+/g, '') // Удаляем просто цифры в конце
      .trim();
    
    const baseAnimeTag = cleanAnime.toLowerCase().replace(/\s+/g, '_');
    const enrichedBooru: string[] = [];
    
    booru.forEach(tag => {
      // Добавляем комбинацию с аниме В ПЕРВУЮ ОЧЕРЕДЬ (наиболее специфично)
      enrichedBooru.push(`${tag}+${baseAnimeTag}`); 
    });
    
    // Добавляем оригинальные теги во вторую очередь (как fallback)
    booru.forEach(tag => {
      enrichedBooru.push(tag);
    });
    
    return { 
      booru: [...new Set(enrichedBooru)], 
      zerochan: [`${cleanName} (${animeName})`, cleanName] 
    };
  }

  return { booru: [...new Set(booru)], zerochan: [cleanName] };
}

async function fetchFromSource(
  source: string, 
  tag: string, 
  page: number, 
  ignoredUrls: string[],
  retryCount: number = 0
): Promise<ArtResult[]> {
  const limit = 50; 
  const controller = new AbortController();
  // Reduce timeout to make failures faster
  const timeoutMs = source === 'safebooru' ? 10000 : 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let results: ArtResult[] = [];
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

    let url = '';
    // Пагинация везде разная: pid для Safebooru, page для остальных
    const encodedTag = tag.split('+').map(t => encodeURIComponent(t)).join('+');
    
    if (source === 'safebooru') {
      url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodedTag}&limit=${limit}&pid=${page - 1}`;
    } else if (source === 'danbooru') {
      url = `https://danbooru.donmai.us/posts.json?tags=${encodedTag}+rating:g&limit=${limit}&page=${page}`;
    } else if (source === 'konachan') {
      url = `https://konachan.net/post.json?tags=${encodedTag}+rating:s&limit=${limit}&page=${page}`;
    } else if (source === 'zerochan') {
      url = `https://www.zerochan.net/${encodeURIComponent(tag)}?json&l=${limit}&p=${page}`;
    }
    
    console.log(`[Art Engine] Requesting ${source}: ${url}`);
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers 
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`[Art Engine] ${source} returned ${res.status}`);
      return [];
    }
    
    let data;
    try {
      const text = await res.text();
      if (!text.trim()) return [];
      data = JSON.parse(text);
    } catch (e) {
      console.warn(`[Art Engine] JSON parse error from ${source}:`, e);
      return [];
    }
    const items = source === 'zerochan' ? (data?.items || []) : (Array.isArray(data) ? data : []);

    if (items.length === 0) return [];

    items.forEach((p: any) => {
      const h = parseInt(p.height || 0);
      const w = parseInt(p.width || 0);
      
      // Фильтр: Портрет (высота > ширины) и качество (высота >= 700)
      // if (h > w && h >= 700) {
      if (h >= 700) {
        let finalUrl = p.file_url || p.large_file_url || p.sample_url || p.full || p.large;
        
        if (source === 'safebooru' && p.directory) {
          finalUrl = `https://safebooru.org/images/${p.directory}/${p.image}`;
        }
        
        // Zerochan fallback для качества
        if (source === 'zerochan' && !finalUrl && p.thumbnail) {
          finalUrl = p.thumbnail.replace(/\/240\//, '/600/').replace(/\.avif$/, '.jpg');
        }

        if (finalUrl && !ignoredUrls.includes(finalUrl)) {
          results.push({ url: finalUrl, source, tag });
        }
      }
    });

    return results;
  } catch (e) {
    console.warn(`[Art Engine] Timeout or error fetching from ${source} with tag "${tag}":`, e);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchHighQualityArt(
  characterName: string, 
  ignoredUrls: string[],
  forceNew: boolean = false,
  customTags?: { booru?: string[], zerochan?: string[] },
  animeName?: string
): Promise<ArtResult | null> {
  // Use a unique cache key if custom tags are provided to avoid cache collisions
  const cacheKey = customTags ? `custom:${characterName}:${JSON.stringify(customTags)}` : 
                   (animeName ? `${characterName}:${animeName}` : characterName);
  
  const { booru: defaultBooru, zerochan: defaultZerochan } = getCharacterTags(characterName, animeName);
  
  const booru = customTags?.booru || defaultBooru;
  const zerochan = customTags?.zerochan || defaultZerochan;

  // 1. Инициализация кэша персонажа
  if (!characterArtCache.has(cacheKey)) {
    characterArtCache.set(cacheKey, { pool: [], pages: {}, returnedUrls: new Set() });
  }
  
  const entry = characterArtCache.get(cacheKey)!;
  
  // 2. Фильтруем текущий пул от банов и уже возвращённых URL
  entry.pool = entry.pool.filter(item => 
    !ignoredUrls.includes(item.url) && !entry.returnedUrls.has(item.url)
  );

  // 3. Если в пуле мало артов — идем добывать новые
  if (entry.pool.length < 5) {
    console.log(`[Art Engine] Infinite Scour: Searching deeper for ${characterName}...`);
    
    const sourceBuckets = new Map<string, ArtResult[]>();
    const sources = ['zerochan', 'konachan', 'danbooru', 'safebooru'];

    // Запускаем запросы ко всем источникам
    const tasks: Promise<{src: string, results: ArtResult[]}>[] = [];

    sources.forEach(src => {
      const tags = src === 'zerochan' ? zerochan : booru;
      console.log(`[Art Engine] Using tags for ${src}:`, tags);
      tags.forEach(tag => {
        const key = `${src}:${tag}`;
        // Увеличиваем номер страницы для этого тега
        const lastPage = entry.pages[key] || 0;
        const nextPage = lastPage + 1;
        entry.pages[key] = nextPage;

        tasks.push((async () => {
          const res = await fetchFromSource(src, tag, nextPage, ignoredUrls, 0);
          return { src, results: res };
        })());
      });
    });

    const allResults = await Promise.allSettled(tasks);
    
    // Log source results for debugging
    const sourceResults: Record<string, number> = {};
    allResults.forEach(r => {
      if (r.status === 'fulfilled') {
        const { src, results } = r.value;
        sourceResults[src] = (sourceResults[src] || 0) + results.length;
        const list = sourceBuckets.get(src) || [];
        results.forEach(item => {
          if (!list.some(x => x.url === item.url)) list.push(item);
        });
        if (list.length > 0) sourceBuckets.set(src, list);
      }
    });
    console.log(`[Art Engine] Source results:`, sourceResults);

    // Честное чередование (Round-Robin)
    const interleaved: ArtResult[] = [];
    const activeSources = Array.from(sourceBuckets.keys());
    
    // Перемешиваем список источников для случайного порядка при каждом наполнении пула
    for (let i = activeSources.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activeSources[i], activeSources[j]] = [activeSources[j], activeSources[i]];
    }
    
    let maxItems = 0;
    sourceBuckets.forEach(list => {
      // Перемешиваем арты внутри каждого источника
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      maxItems = Math.max(maxItems, list.length);
    });

    for (let i = 0; i < maxItems; i++) {
      for (const src of activeSources) {
        const bucket = sourceBuckets.get(src);
        if (bucket && bucket[i]) interleaved.push(bucket[i]);
      }
    }

    // Добавляем новые арты в конец текущего пула
    entry.pool = [...entry.pool, ...interleaved];
    console.log(`[Art Engine] Infinite Pool: +${interleaved.length} new images. Next pages tracked.`);
    
    // Если всё еще пусто (дошли до конца всех страниц), сбрасываем страницы и пробуем рандом
    if (entry.pool.length === 0) {
      console.warn(`[Art Engine] Exhausted all pages for ${characterName}. Resetting pages.`);
      entry.pages = {}; 
    }
  }

  // 4. Выбор арта с ротацией источников
  let selected = entry.pool.shift() || null;
  
  // Если один источник доминирует, принудительно ротируем
  if (selected && entry.pool.length > 0) {
    const sourceCount: Record<string, number> = {};
    entry.pool.forEach(item => {
      sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
    });
    
    // Если один источник составляет >70% пула, ищем арт из другого источника
    const dominantSource = Object.entries(sourceCount).find(([_, count]) => count > entry.pool.length * 0.7);
    const selectedSource = selected.source;
    if (dominantSource && dominantSource[0] === selectedSource) {
      console.log(`[Art Engine] Source rotation: ${selectedSource} dominates (${dominantSource[1]}/${entry.pool.length}), seeking alternative`);
      const alternativeArt = entry.pool.find(item => item.source !== selectedSource);
      if (alternativeArt) {
        // Возвращаем выбранный арт в пул и берем альтернативный
        entry.pool.unshift(selected);
        selected = alternativeArt;
        console.log(`[Art Engine] Rotated to alternative source: ${selected.source}`);
      } else {
        console.log(`[Art Engine] No alternative sources available - all other sources returned 0 results`);
      }
    }
  }

  if (selected) {
    entry.returnedUrls.add(selected.url); // Track as returned to avoid reselection
    console.log(`[Art Engine] Selected: ${selected.source.toUpperCase()} | Page: ${entry.pages[`${selected.source}:${selected.tag}`]} | ${characterName}`);
    return selected;
  }

  return null;
}