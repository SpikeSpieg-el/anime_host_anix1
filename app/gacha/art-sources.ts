/**
 * INFINITE ART ENGINE V5.2 - ANTI-TIMEOUT & DIRECT CDN
 */

export interface ArtResult {
  url: string;
  source: string;
  tag: string;
}

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

  return { 
    booru: [...new Set(booru)], 
    zerochan: [cleanName] 
  };
}

async function fetchFromSource(source: string, tag: string, deepSearch: boolean): Promise<ArtResult[]> {
  const limit = 40; 
  const page = deepSearch ? Math.floor(Math.random() * 4) + 1 : 1;
  const controller = new AbortController();
  // Уменьшаем таймаут до 4 секунд, чтобы не вешать весь призыв, если один сайт тормозит
  const timeoutId = setTimeout(() => controller.abort(), 4000); 

  try {
    let results: ArtResult[] = [];
    const headers = { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    };

    let url = '';
    if (source === 'safebooru') {
      url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=${limit}&pid=${page - 1}`;
    } else if (source === 'danbooru') {
      url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}+rating:g&limit=${limit}&page=${page}`;
    } else if (source === 'konachan') {
      url = `https://konachan.net/post.json?tags=${encodeURIComponent(tag)}&limit=${limit}&page=${page}`;
    } else if (source === 'zerochan') {
      url = `https://www.zerochan.net/${encodeURIComponent(tag)}?json&l=${limit}&p=${page}`;
    }

    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return [];

    const data = await res.json();
    
    // --- BOORU PROCESSING ---
    if (source === 'safebooru' || source === 'danbooru' || source === 'konachan') {
      const items = Array.isArray(data) ? data : [];
      items.forEach((p: any) => {
        const h = parseInt(p.height || 0);
        const w = parseInt(p.width || 0);
        if (h > w && h >= 700) {
          let finalUrl = p.file_url || p.large_file_url || p.sample_url;
          if (source === 'safebooru' && p.directory) {
            finalUrl = `https://safebooru.org/images/${p.directory}/${p.image}`;
          }
          if (finalUrl) results.push({ url: finalUrl, source, tag });
        }
      });
    } 
    // --- ZEROCHAN PROCESSING (STABLE LINKS) ---
    else if (source === 'zerochan' && data?.items) {
      data.items.forEach((item: any) => {
        if (parseInt(item.height) > parseInt(item.width) && parseInt(item.height) >= 700) {
          // Zerochan CDN s3 часто тормозит. Используем прямые ссылки на превью, 
          // которые быстрее грузятся и реже выдают 404/500
          const fastUrl = item.large || item.full || item.thumbnail?.replace(/\/240\//, '/600/');
          if (fastUrl) results.push({ url: fastUrl, source, tag });
        }
      });
    }

    return results;
  } catch (e) {
    // Если упали по таймауту или ошибке - просто возвращаем пустой массив для этого источника
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

const characterArtCache = new Map<string, { pool: ArtResult[] }>();

export async function fetchHighQualityArt(
  characterName: string, 
  ignoredUrls: string[],
  forceNew: boolean = false
): Promise<ArtResult | null> {
  const cacheKey = characterName;
  const { booru, zerochan } = getCharacterTags(characterName);

  let entry = characterArtCache.get(cacheKey);
  let pool = (entry?.pool || []).filter(item => !ignoredUrls.includes(item.url));

  if (pool.length < 3) {
    console.log(`[Art Engine] Starting parallel fetch for: ${characterName}`);
    
    const tasks: Promise<ArtResult[]>[] = [];
    zerochan.forEach(t => tasks.push(fetchFromSource('zerochan', t, forceNew)));
    booru.forEach(t => {
      tasks.push(fetchFromSource('konachan', t, forceNew));
      tasks.push(fetchFromSource('danbooru', t, forceNew));
      tasks.push(fetchFromSource('safebooru', t, forceNew));
    });

    const allResults = await Promise.allSettled(tasks);
    const sourceBuckets = new Map<string, ArtResult[]>();
    
    allResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        r.value.forEach(item => {
          const list = sourceBuckets.get(item.source) || [];
          if (!list.some(x => x.url === item.url)) {
            list.push(item);
            sourceBuckets.set(item.source, list);
          }
        });
      }
    });

    const interleaved: ArtResult[] = [];
    const sources = Array.from(sourceBuckets.keys()).sort(() => Math.random() - 0.5);
    if (sources.length === 0) return null;

    sourceBuckets.forEach(list => list.sort(() => Math.random() - 0.5));

    let maxItems = 0;
    sourceBuckets.forEach(list => maxItems = Math.max(maxItems, list.length));

    for (let i = 0; i < maxItems; i++) {
      for (const src of sources) {
        const bucket = sourceBuckets.get(src);
        if (bucket && bucket[i]) interleaved.push(bucket[i]);
      }
    }

    pool = interleaved;
    console.log(`[Art Engine] Pool Built. Total: ${pool.length} images.`);
  }

  const selected = pool[0] || null;
  if (selected) {
    console.log(`[Art Engine] Selected: ${selected.source.toUpperCase()} | ${selected.url}`);
    characterArtCache.set(cacheKey, { pool: pool.slice(1) });
  }
  return selected;
}