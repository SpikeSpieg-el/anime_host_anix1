/**
 * INFINITE ART ENGINE V5.4 - INFINITE EXPLORER MODE (FIXED & OPTIMIZED)
 */

export interface ArtResult {
  url: string;
  source: string;
  tag: string;
  hash?: string;
}

interface CacheEntry {
  pool: ArtResult[];
  pages: Record<string, number>;
  returnedUrls: Set<string>; // Track URLs already returned to client
  returnedHashes: Set<string>;
}

const characterArtCache = new Map<string, CacheEntry>();
const canonicalTagCache = new Map<string, BooruTagResolution>();

interface BooruTagResolution {
  exact: string[];
  characterOnly: string[];
}

interface DanbooruTag {
  name: string;
  category: number;
  post_count: number;
}

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
    
    return { 
      booru:[...new Set(enrichedBooru)], 
      zerochan:[`${cleanName} (${animeName})`]
    };
  }

  return { booru: [...new Set(booru)], zerochan: [cleanName] };
}

function normalizeTagName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitTags(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) {
    return value.flatMap(tag => typeof tag === 'string' ? tag.split(/\s+/) : []);
  }
  return [];
}

function getRequestedTags(query: string): { character: string; copyright: string[] } | null {
  const tags = query.split('+').filter(Boolean);
  if (!tags[0]) return null;
  return { character: tags[0], copyright: tags.slice(1) };
}

function hasExactTags(post: Record<string, unknown>, source: string, query: string): boolean {
  const requested = getRequestedTags(query);
  if (!requested) return false;

  if (source === 'danbooru') {
    const characters = splitTags(post.tag_string_character);
    const copyrights = splitTags(post.tag_string_copyright);
    const rating = typeof post.rating === 'string' ? post.rating : '';
    return (rating === 'g' || rating === 's') &&
      characters.includes(requested.character) &&
      requested.copyright.every(tag => copyrights.includes(tag));
  }

  const tags = splitTags(post.tags);
  return tags.includes(requested.character) && requested.copyright.every(tag => tags.includes(tag));
}

function getNameVariants(name: string): string[] {
  const englishName = name.includes('/') ? name.split('/').at(-1) || name : name;
  const normalized = normalizeTagName(englishName);
  const parts = normalized.split('_').filter(Boolean);
  if (!normalized) return [];
  return [...new Set([normalized, parts.slice().reverse().join('_'), parts[0]])];
}

function getTagQualifier(tag: string): string | null {
  const match = tag.match(/_\(([^)]+)\)$/);
  return match?.[1] || null;
}

async function getDanbooruTags(pattern: string, category: 3 | 4 = 4): Promise<DanbooruTag[]> {
  if (!pattern) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(
      `https://danbooru.donmai.us/tags.json?search[name_matches]=${encodeURIComponent(`${pattern}*`)}&search[category]=${category}&limit=50`,
      { signal: controller.signal, headers: { 'User-Agent': 'Weebx-Art-Resolver/1.0' } }
    );
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return data.filter((tag): tag is DanbooruTag =>
      typeof tag?.name === 'string' && tag.category === category && typeof tag.post_count === 'number'
    );
  } catch (error) {
    console.warn(`[Art Engine] Could not resolve Danbooru tags for "${pattern}":`, error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveCanonicalBooruTags(characterName: string, animeName?: string): Promise<BooruTagResolution> {
  const cacheKey = `${characterName}:${animeName || ''}`;
  const cached = canonicalTagCache.get(cacheKey);
  if (cached) return cached;

  const characterVariants = getNameVariants(characterName);
  const titleVariants = getNameVariants(animeName || '');
  const titleTokens = normalizeTagName(animeName || '').split('_').filter(token => token.length > 2);
  const [candidates, copyrightCandidates] = await Promise.all([
    Promise.all(characterVariants.slice(0, 2).map(pattern => getDanbooruTags(pattern))).then(results => results.flat()),
    Promise.all(titleVariants.slice(0, 2).map(pattern => getDanbooruTags(pattern, 3))).then(results => results.flat())
  ]);
  const uniqueCandidates = [...new Map(candidates.map(tag => [tag.name, tag])).values()];
  const requestedNameTags = new Set(characterVariants.slice(0, 2));
  const requestedTitleTags = new Set(titleVariants.slice(0, 2));
  const canonicalCopyrights = [...new Map(copyrightCandidates.map(tag => [tag.name, tag])).values()]
    .filter(tag => requestedTitleTags.has(tag.name))
    .sort((left, right) => right.post_count - left.post_count)
    .map(tag => tag.name);

  const characterTags = uniqueCandidates
    .filter(tag => {
      const unqualified = tag.name.replace(/_\([^)]*\)$/, '');
      const qualifier = getTagQualifier(tag.name);
      return requestedNameTags.has(unqualified) &&
        (!canonicalCopyrights.length || !qualifier || canonicalCopyrights.includes(qualifier));
    })
    .sort((left, right) => {
      const score = (tag: DanbooruTag) => {
        const qualifier = getTagQualifier(tag.name) || '';
        const titleMatches = titleTokens.filter(token => qualifier.includes(token)).length;
        return titleMatches * 1000000 + tag.post_count;
      };
      return score(right) - score(left);
    })
    .slice(0, 3);

  const exact = characterTags.map(tag => {
    const copyright = getTagQualifier(tag.name) || canonicalCopyrights[0];
    return copyright ? `${tag.name}+${copyright}` : tag.name;
  });
  const characterOnly = characterTags.length === 1 && exact[0]?.includes('+') ? [characterTags[0].name] : [];
  const resolution = { exact, characterOnly };

  canonicalTagCache.set(cacheKey, resolution);
  return resolution;
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
    } else if (source === 'yandere') {
      url = `https://yande.re/post.json?tags=${encodedTag}+rating:s&limit=${limit}&page=${page}`;
    }
    
    console.log(`[Art Engine] Requesting ${source}: ${url}`);
    
    const res = await fetch(url, { signal: controller.signal, headers });
    
    if (!res.ok) {
      console.warn(`[Art Engine] ${source} returned ${res.status}`);
      return[];
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
      const h = parseInt(p.height || p.image_height || 0);
      
      // Фильтр качества (высота >= 700)
      if (h >= 700) {
        let finalUrl = p.file_url || p.large_file_url || p.sample_url || p.full || p.large;
        
        if (source === 'safebooru' && p.directory) {
          finalUrl = `https://safebooru.org/images/${p.directory}/${p.image}`;
        }
        
        if (source === 'zerochan' && !finalUrl && p.thumbnail) {
          finalUrl = p.thumbnail.replace(/\/240\//, '/600/').replace(/\.avif$/, '.jpg');
        }

        if (finalUrl && !ignoredUrls.includes(finalUrl) && hasExactTags(p, source, tag)) {
          results.push({ url: finalUrl, source, tag, hash: p.md5 || p.hash });
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
  animeName?: string,
  useCharacterFallback: boolean = false
): Promise<ArtResult | null> {
  
  const cacheKey = customTags ? `custom:${characterName}:${JSON.stringify(customTags)}` : 
                   (animeName ? `${characterName}:${animeName}` : characterName);
  
  const tagResolution = await resolveCanonicalBooruTags(characterName, animeName);
  
  const booru = customTags?.booru || (useCharacterFallback ? tagResolution.characterOnly : tagResolution.exact);
  const zerochan = customTags?.zerochan || [];

  // 1. Инициализация кэша персонажа
  if (!characterArtCache.has(cacheKey) || forceNew) {
    if (!characterArtCache.has(cacheKey)) {
      characterArtCache.set(cacheKey, { pool:[], pages: {}, returnedUrls: new Set(), returnedHashes: new Set() });
    }
  }
  
  const entry = characterArtCache.get(cacheKey)!;
  
  // 2. Фильтруем текущий пул от банов и уже возвращённых URL
  entry.pool = entry.pool.filter(item => 
    !ignoredUrls.includes(item.url) &&
    !entry.returnedUrls.has(item.url) &&
    (!item.hash || !entry.returnedHashes.has(item.hash))
  );

  // 3. Если в пуле мало артов — идем добывать новые
  if (entry.pool.length < 5) {
    console.log(`[Art Engine] Infinite Scour: Searching deeper for ${characterName}...`);
    
    const sourceBuckets = new Map<string, ArtResult[]>();
    const sources = ['zerochan', 'konachan', 'danbooru', 'safebooru', 'yandere'];

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
          if (!list.some(x => x.url === item.url || (item.hash && x.hash === item.hash))) list.push(item);
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

    const poolUrls = new Set([...entry.returnedUrls, ...entry.pool.map(item => item.url)]);
    const poolHashes = new Set([...entry.returnedHashes, ...entry.pool.flatMap(item => item.hash ? [item.hash] : [])]);
    const uniqueInterleaved = interleaved.filter(item => {
      if (poolUrls.has(item.url) || (item.hash && poolHashes.has(item.hash))) return false;
      poolUrls.add(item.url);
      if (item.hash) poolHashes.add(item.hash);
      return true;
    });
    entry.pool =[...entry.pool, ...uniqueInterleaved];
    console.log(`[Art Engine] Infinite Pool: +${uniqueInterleaved.length} new images. Next pages tracked.`);
    
    // ИСПРАВЛЕНИЕ: Автоматический ретрай, если ничего не найдено (сброс и попытка с 1-й страницы)
    if (entry.pool.length === 0) {
      console.warn(`[Art Engine] Exhausted all pages for ${characterName}. Resetting pages.`);
      entry.pages = {}; 
      // Предотвращаем бесконечный цикл: ретрай только если это не forceNew запрос
      if (!forceNew) {
         console.log(`[Art Engine] Retrying search from page 1...`);
         return fetchHighQualityArt(characterName, ignoredUrls, true, customTags, animeName, useCharacterFallback);
      }
      if (!customTags && !useCharacterFallback && tagResolution.characterOnly.length > 0) {
        console.log(`[Art Engine] No exact copyright match for ${characterName}; using its unique character tag.`);
        return fetchHighQualityArt(characterName, ignoredUrls, true, undefined, animeName, true);
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
    if (selected.hash) entry.returnedHashes.add(selected.hash);
    console.log(`[Art Engine] Selected: ${selected.source.toUpperCase()} | Page: ${entry.pages[`${selected.source}:${selected.tag}`]} | ${characterName}`);
    return selected;
  }

  return null;
}