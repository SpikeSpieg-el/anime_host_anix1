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
  pages: Record<string, number>; // Храним последнюю страницу для каждого источника
}

const characterArtCache = new Map<string, CacheEntry>();

function getCharacterTags(name: string): { booru: string[], zerochan: string[] } {
  const engName = name.includes('/') ? name.split('/')[1] : name;
  const cleanName = engName.replace(/\([^)]*\)/g, '').trim();
  const parts = cleanName.toLowerCase().split(/\s+/);
  
  const booru: string[] = [];
  if (parts.length >= 2) {
    booru.push(`${parts[parts.length - 1]}_${parts[0]}`); 
    booru.push(parts.join('_')); 
  } else {
    booru.push(parts[0]);
  }
  return { booru: [...new Set(booru)], zerochan: [cleanName] };
}

async function fetchFromSource(
  source: string, 
  tag: string, 
  page: number, 
  ignoredUrls: string[]
): Promise<ArtResult[]> {
  const limit = 50; 
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    let results: ArtResult[] = [];
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

    let url = '';
    // Пагинация везде разная: pid для Safebooru, page для остальных
    if (source === 'safebooru') {
      url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=${limit}&pid=${page - 1}`;
    } else if (source === 'danbooru') {
      url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}+rating:g&limit=${limit}&page=${page}`;
    } else if (source === 'konachan') {
      url = `https://konachan.net/post.json?tags=${encodeURIComponent(tag)}+rating:s&limit=${limit}&page=${page}`;
    } else if (source === 'zerochan') {
      url = `https://www.zerochan.net/${encodeURIComponent(tag)}?json&l=${limit}&p=${page}`;
    }

    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return [];

    const data = await res.json();
    const items = source === 'zerochan' ? (data?.items || []) : (Array.isArray(data) ? data : []);

    if (items.length === 0) return [];

    items.forEach((p: any) => {
      const h = parseInt(p.height || 0);
      const w = parseInt(p.width || 0);
      
      // Фильтр: Портрет (высота > ширина) и качество (высота >= 700)
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
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchHighQualityArt(
  characterName: string, 
  ignoredUrls: string[],
  forceNew: boolean = false
): Promise<ArtResult | null> {
  const cacheKey = characterName;
  const { booru, zerochan } = getCharacterTags(characterName);

  // 1. Инициализация кэша персонажа
  if (!characterArtCache.has(cacheKey)) {
    characterArtCache.set(cacheKey, { pool: [], pages: {} });
  }
  
  const entry = characterArtCache.get(cacheKey)!;
  
  // 2. Фильтруем текущий пул от банов
  entry.pool = entry.pool.filter(item => !ignoredUrls.includes(item.url));

  // 3. Если в пуле мало артов — идем добывать новые
  if (entry.pool.length < 5) {
    console.log(`[Art Engine] Infinite Scour: Searching deeper for ${characterName}...`);
    
    const sourceBuckets = new Map<string, ArtResult[]>();
    const sources = ['zerochan', 'konachan', 'danbooru', 'safebooru'];

    // Запускаем запросы ко всем источникам
    const tasks: Promise<{src: string, results: ArtResult[]}>[] = [];

    sources.forEach(src => {
      const tags = src === 'zerochan' ? zerochan : booru;
      tags.forEach(tag => {
        const key = `${src}:${tag}`;
        // Увеличиваем номер страницы для этого тега
        const lastPage = entry.pages[key] || 0;
        const nextPage = lastPage + 1;
        entry.pages[key] = nextPage;

        tasks.push((async () => {
          const res = await fetchFromSource(src, tag, nextPage, ignoredUrls);
          return { src, results: res };
        })());
      });
    });

    const allResults = await Promise.allSettled(tasks);
    
    allResults.forEach(r => {
      if (r.status === 'fulfilled') {
        const { src, results } = r.value;
        const list = sourceBuckets.get(src) || [];
        results.forEach(item => {
          if (!list.some(x => x.url === item.url)) list.push(item);
        });
        if (list.length > 0) sourceBuckets.set(src, list);
      }
    });

    // Честное чередование (Round-Robin)
    const interleaved: ArtResult[] = [];
    const activeSources = Array.from(sourceBuckets.keys()).sort(() => Math.random() - 0.5);
    
    let maxItems = 0;
    sourceBuckets.forEach(list => {
      list.sort(() => Math.random() - 0.5);
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

  // 4. Выбор арта
  const selected = entry.pool.shift() || null;

  if (selected) {
    console.log(`[Art Engine] Selected: ${selected.source.toUpperCase()} | Page: ${entry.pages[`${selected.source}:${selected.tag}`]} | ${characterName}`);
    return selected;
  }

  return null;
}