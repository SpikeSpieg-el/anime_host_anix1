"use server"

const HENTASIS_BASE = "http://hentasis1.top"

function cleanTitle(title: string): string {
  if (!title) return ""
  return title
    .replace(/The Animation/i, "") 
    .replace(/OVA/i, "")
    // Оставляем только буквы и цифры для сравнения
    .replace(/[^\w\sа-яёА-ЯЁ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchSearchPage(query: string): Promise<{ html: string, url: string }> {
  // На hentasis поиск лучше работает по короткой фразе, если полное название слишком длинное
  const searchUrl = `${HENTASIS_BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": HENTASIS_BASE
      },
      cache: 'no-store'
    })
    return { html: await res.text(), url: res.url }
  } catch (e) {
    return { html: "", url: "" }
  }
}

function findLinkInHtml(html: string, originalTitle: string): string | null {
  // Ищем ссылки на новости /ID-name.html
  const regex = /href=["']((?:https?:\/\/[^\/]+)?\/(\d+)-([^"']+\.html))["']/gi
  let match
  const matches: { url: string, score: number }[] = []
  
  const target = originalTitle.toLowerCase()
  
  while ((match = regex.exec(html)) !== null) {
    let url = match[1]
    if (url.startsWith('/')) url = HENTASIS_BASE + url
    
    // Считаем "схожесть": сколько слов из названия есть в URL
    const slug = match[3].toLowerCase()
    const words = target.split(' ').filter(w => w.length > 2)
    const hits = words.filter(word => slug.includes(word)).length
    
    if (hits > 0) {
      matches.push({ url, score: hits })
    }
  }

  // Сортируем по количеству совпадений и берем лучшую
  return matches.sort((a, b) => b.score - a.score)[0]?.url || null
}

/**
 * Улучшенный парсер плейлиста PlayerJS для Hentasis
 */
/**
 * Расшифровка строк PlayerJS (Base64)
 */
function decodePlayerJs(data: string): string {
  if (!data.startsWith("#")) return data;
  try {
    // Убираем '#' и декодируем из base64
    const cleaned = data.substring(1);
    return Buffer.from(cleaned, 'base64').toString('utf-8');
  } catch (e) {
    return data;
  }
}

function parsePlaylist(html: string): {name: string, url: string}[] {
  const playlist: {name: string, url: string}[] = [];
  
  // 1. Поиск конфига PlayerJS (file: "...")
  const fileDataRegex = /["']file["']\s*:\s*["']([^"']+)["']/i;
  const match = html.match(fileDataRegex);

  if (match) {
    let rawData = decodePlayerJs(match[1]); // Расшифровываем, если нужно

    if (rawData.startsWith('[') && rawData.includes('{')) {
      try {
        const json = JSON.parse(rawData);
        return json.map((item: any, idx: number) => ({
          name: item.title || `Серия ${idx + 1}`,
          url: item.file
        }));
      } catch (e) {}
    }

    // Формат списка: "Название]url,Название]url"
    if (rawData.includes(']')) {
      return rawData.split(',').map(part => {
        const [name, url] = part.split(']');
        return { 
          name: name.replace('[', '').trim(), 
          url: url.trim() 
        };
      });
    }

    // Если просто одна ссылка
    if (rawData.startsWith('http')) {
      return [{ name: "Основное видео", url: rawData }];
    }
  }

  // 2. Резервный поиск прямых MP4 (Исправлено условие фильтрации)
  const mp4Regex = /(https?:\/\/[^\s"'<>]+?\.mp4)/gi;
  const seenUrls = new Set();
  let mp4Match;
  
  while ((mp4Match = mp4Regex.exec(html)) !== null) {
    const url = mp4Match[1];
    // Убрали проверку .includes('hentai'), так как домен может быть hentasis или sv...
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      const fileName = url.split('/').pop()?.split('_')[0] || `Видео ${playlist.length + 1}`;
      playlist.push({ 
        name: decodeURIComponent(fileName).replace(/_/g, ' '), 
        url 
      });
    }
  }

  return playlist;
}

export async function getHentaiPlaylist(title: string, originalTitle: string, episode: number): Promise<{name: string, url: string}[]> {
  const cleanedOriginal = cleanTitle(originalTitle)
  
  console.log(`[HentaiSearch] Ищем: ${cleanedOriginal}`);

  // 1. Поиск страницы
  const { html: searchHtml, url: finalUrl } = await fetchSearchPage(cleanedOriginal)
  
  // Если нас редиректнуло сразу на страницу аниме
  let pageUrl: string | null = finalUrl.includes('.html') && !finalUrl.includes('do=search') 
    ? finalUrl 
    : findLinkInHtml(searchHtml, cleanedOriginal)
  
  if (!pageUrl) {
    console.log("[HentaiSearch] Страница не найдена");
    return []
  }

  console.log(`[HentaiSearch] Найдена страница: ${pageUrl}`);

  // 2. Загрузка страницы аниме
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      cache: 'no-store'
    })
    const pageHtml = await response.text()
    
    // 3. Извлечение плейлиста
    let rawPlaylist = parsePlaylist(pageHtml)
    
    if (rawPlaylist.length === 0) {
        console.log("[HentaiSearch] Плейлист пуст после парсинга");
        return [];
    }

    // 4. Проксирование ссылок
    return rawPlaylist.map(item => ({
      name: item.name,
      url: `/api/proxy/video?url=${encodeURIComponent(item.url)}`
    }))

  } catch (e) {
    console.error("[HentaiAction] Ошибка:", e)
    return []
  }
}