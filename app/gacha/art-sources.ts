/**
 * INFINITE ART ENGINE V5.4 - INFINITE EXPLORER MODE (FIXED & OPTIMIZED)
 */

export interface ArtResult {
  url: string;
  source: string;
  tag: string;
}

function extractPinterestUrls(html: string): string[] {
  if (!html) return[];

  // Pinterest pages commonly embed image URLs as i.pinimg.com/{width}x/... or i.pinimg.com/originals/...
  const matches = html.match(/https:\/\/i\.pinimg\.com\/(?:originals|\d+x)\/[^"'\\\s)]+\.(?:jpg|jpeg|png|webp)/gi) ||[];
  const unique = Array.from(new Set(matches));

  // Prefer originals first, then larger widths
  unique.sort((a, b) => {
    const aIsOriginal = a.includes('/originals/');
    const bIsOriginal = b.includes('/originals/');
    if (aIsOriginal !== bIsOriginal) return aIsOriginal ? -1 : 1;

    const aSize = a.match(/\/([0-9]+)x\//i);
    const bSize = b.match(/\/([0-9]+)x\//i);
    const aNum = aSize ? parseInt(aSize[1], 10) : 0;
    const bNum = bSize ? parseInt(bSize[1], 10) : 0;
    return bNum - aNum;
  });

  return unique;
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
  
  const booru: string[] =[];
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];
    booru.push(`${lastName}_${firstName}`); 
    booru.push(parts.join('_')); 
  } else {
    booru.push(parts[0]);
  }

  if (animeName) {
    let cleanAnime = animeName.replace(/\([^)]*\)/g, '').trim();
    
    cleanAnime = cleanAnime
      .replace(/\s+(Movie|Film|movie|film)/gi, '')
      .replace(/\s+(Part|Season|S)\s*\d+/gi, '')
      .replace(/\s+\d+/g, '')
      .trim();
    
    const baseAnimeTag = cleanAnime.toLowerCase().replace(/\s+/g, '_');
    const enrichedBooru: string[] =[];
    
    // Сначала добавляем специфичные теги (персонаж + аниме)
    booru.forEach(tag => {
      enrichedBooru.push(`${tag}+${baseAnimeTag}`); 
    });
    
    // Добавляем обычные теги как fallback
    booru.forEach(tag => {
      enrichedBooru.push(tag);
    });
    
    return { 
      booru:[...new Set(enrichedBooru)], 
      zerochan:[`${cleanName} (${animeName})`, cleanName] 
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
  const timeoutMs = source === 'safebooru' ? 10000 : 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let results: ArtResult[] =[];
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

    let url = '';
    const encodedTag = tag.split('+').map(t => encodeURIComponent(t)).join('+');
    
    if (source === 'safebooru') {
      url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodedTag}&limit=${limit}&pid=${page - 1}`;
    } else if (source === 'danbooru') {
      // ИСПРАВЛЕНИЕ: Danbooru позволяет максимум 2 тега анонимам.
      // Если тегов уже 2 (например персонаж + аниме), мы не можем добавить +rating:g
      let danbooruTags = encodedTag;
      if (danbooruTags.split('+').length < 2) {
        danbooruTags += '+rating:g';
      }
      url = `https://danbooru.donmai.us/posts.json?tags=${danbooruTags}&limit=${limit}&page=${page}`;
    } else if (source === 'konachan') {
      url = `https://konachan.net/post.json?tags=${encodedTag}+rating:s&limit=${limit}&page=${page}`;
    } else if (source === 'zerochan') {
      url = `https://www.zerochan.net/${encodeURIComponent(tag)}?json&l=${limit}&p=${page}`;
    } else if (source === 'pinterest') {
      const query = tag.replace(/[_+]/g, ' ').trim();
      url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed&term_meta[]=${encodeURIComponent(query)}|typed`;
    }
    
    console.log(`[Art Engine] Requesting ${source}: ${url}`);
    
    const res = await fetch(url, { signal: controller.signal, headers });
    
    if (!res.ok) {
      console.warn(`[Art Engine] ${source} returned ${res.status}`);
      return[];
    }

    if (source === 'pinterest') {
      const html = await res.text();
      const urls = extractPinterestUrls(html);
      urls.forEach(u => {
        if (!ignoredUrls.includes(u)) results.push({ url: u, source, tag });
      });
      return results;
    }

    let data;
    try {
      const text = await res.text();
      if (!text.trim()) return[];
      data = JSON.parse(text);
    } catch (e) {
      console.warn(`[Art Engine] JSON parse error from ${source}:`, e);
      return[];
    }
    const items = source === 'zerochan' ? (data?.items || []) : (Array.isArray(data) ? data :[]);

    if (items.length === 0) return[];

    items.forEach((p: any) => {
      const h = parseInt(p.height || 0);
      
      // Фильтр качества (высота >= 700)
      if (h >= 700) {
        let finalUrl = p.file_url || p.large_file_url || p.sample_url || p.full || p.large;
        
        if (source === 'safebooru' && p.directory) {
          finalUrl = `https://safebooru.org/images/${p.directory}/${p.image}`;
        }
        
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
    return[];
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
  
  const cacheKey = customTags ? `custom:${characterName}:${JSON.stringify(customTags)}` : 
                   (animeName ? `${characterName}:${animeName}` : characterName);
  
  const { booru: defaultBooru, zerochan: defaultZerochan } = getCharacterTags(characterName, animeName);
  
  const booru = customTags?.booru || defaultBooru;
  const zerochan = customTags?.zerochan || defaultZerochan;

  // 1. Инициализация кэша персонажа
  if (!characterArtCache.has(cacheKey) || forceNew) {
    if (!characterArtCache.has(cacheKey)) {
      characterArtCache.set(cacheKey, { pool:[], pages: {}, returnedUrls: new Set() });
    }
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
    const sources =['zerochan', 'konachan', 'danbooru', 'safebooru', 'pinterest'];

    const tasks: Promise<{src: string, results: ArtResult[]}>[] =[];

    sources.forEach(src => {
      const tags = src === 'zerochan' ? zerochan : booru;
      // Оптимизация: берем первые 2 тега, чтобы не спамить API кучей однотипных запросов одновременно
      const tagsToUse = tags.slice(0, 2); 
      
      console.log(`[Art Engine] Using tags for ${src}:`, tagsToUse);
      tagsToUse.forEach(tag => {
        const key = `${src}:${tag}`;
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
    
    const sourceResults: Record<string, number> = {};
    allResults.forEach(r => {
      if (r.status === 'fulfilled') {
        const { src, results } = r.value;
        sourceResults[src] = (sourceResults[src] || 0) + results.length;
        const list = sourceBuckets.get(src) ||[];
        results.forEach(item => {
          if (!list.some(x => x.url === item.url)) list.push(item);
        });
        if (list.length > 0) sourceBuckets.set(src, list);
      }
    });
    console.log(`[Art Engine] Source results:`, sourceResults);

    // Честное чередование (Round-Robin)
    const interleaved: ArtResult[] =[];
    const activeSources = Array.from(sourceBuckets.keys());
    
    for (let i = activeSources.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activeSources[i], activeSources[j]] = [activeSources[j], activeSources[i]];
    }
    
    let maxItems = 0;
    sourceBuckets.forEach(list => {
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

    entry.pool =[...entry.pool, ...interleaved];
    console.log(`[Art Engine] Infinite Pool: +${interleaved.length} new images. Next pages tracked.`);
    
    // ИСПРАВЛЕНИЕ: Автоматический ретрай, если ничего не найдено (сброс и попытка с 1-й страницы)
    if (entry.pool.length === 0) {
      console.warn(`[Art Engine] Exhausted all pages for ${characterName}. Resetting pages.`);
      entry.pages = {}; 
      // Предотвращаем бесконечный цикл: ретрай только если это не forceNew запрос
      if (!forceNew) {
         console.log(`[Art Engine] Retrying search from page 1...`);
         return fetchHighQualityArt(characterName, ignoredUrls, true, customTags, animeName);
      }
    }
  }

  // 4. Выбор арта с ротацией источников
  let selected = entry.pool.shift() || null;
  
  if (selected && entry.pool.length > 0) {
    const sourceCount: Record<string, number> = {};
    entry.pool.forEach(item => {
      sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
    });
    
    const dominantSource = Object.entries(sourceCount).find(([_, count]) => count > entry.pool.length * 0.7);
    const selectedSource = selected.source;
    
    if (dominantSource && dominantSource[0] === selectedSource) {
      console.log(`[Art Engine] Source rotation: ${selectedSource} dominates (${dominantSource[1]}/${entry.pool.length}), seeking alternative`);
      
      // ИСПРАВЛЕНИЕ: Корректно находим и ВЫРЕЗАЕМ альтернативный арт из массива
      const altIndex = entry.pool.findIndex(item => item.source !== selectedSource);
      if (altIndex !== -1) {
        const alternativeArt = entry.pool.splice(altIndex, 1)[0]; // Вырезаем из пула
        entry.pool.unshift(selected); // Возвращаем текущий "доминирующий" арт обратно в пул
        selected = alternativeArt; // Берем альтернативный
        console.log(`[Art Engine] Rotated to alternative source: ${selected.source}`);
      } else {
        console.log(`[Art Engine] No alternative sources available`);
      }
    }
  }

  if (selected) {
    entry.returnedUrls.add(selected.url);
    console.log(`[Art Engine] Selected: ${selected.source.toUpperCase()} | Page: ${entry.pages[`${selected.source}:${selected.tag}`]} | ${characterName}`);
    return selected;
  }

  return null;
}