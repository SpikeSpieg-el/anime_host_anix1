import { ShikimoriAnime } from "./types";
import { NSFW_GENRE_IDS } from "./config";
import { SITE_URL } from "./config";

// --- URL Utilities ---
export function normalizeShikimoriUrl(value: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return raw;
  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`;
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${SITE_URL}${raw}`;
  return `${SITE_URL}/${raw}`;
}

export function upgradeShikimoriUrl(url: string): string {
  if (!url) return "";
  const normalized = normalizeShikimoriUrl(url);
  return normalized
    .replace('/x96/', '/original/')
    .replace('/x48/', '/original/')
    .replace('/preview/', '/original/')
    .replace('_x96', '_original')
    .replace('_preview', '_original');
}

// --- Transliteration ---
export function transliterateRuToEn(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  return text.split('').map(char => map[char] || char).join('');
}

export function containsCyrillic(text: string): boolean {
  return /[а-яёА-ЯЁ]/.test(text);
}

export function generateSearchVariants(query: string): string[] {
  const variants: string[] = [query.trim()];
  if (containsCyrillic(query)) {
    const transliterated = transliterateRuToEn(query.trim());
    if (transliterated !== query.trim()) {
      variants.push(transliterated);
    }
  }
  return variants;
}

// --- STRICT SAFETY CHECK (Исправление проблемы с пародией) ---
export function isAnimeSafe(item: ShikimoriAnime): boolean {
  // 1. Проверка рейтинга (самая надежная)
  // rx = Hentai, x = Hentai (old notation), r_plus = Mild Nudity (Borderline)
  if (item.rating === 'rx' || item.rating === 'x' || item.rating === 'r_plus') {
    return false;
  }

  // 2. Проверка жанров
  if (item.genres && Array.isArray(item.genres)) {
    const hasNsfwGenre = item.genres.some(g => 
      NSFW_GENRE_IDS.includes(g.id) || 
      g.name.toLowerCase() === 'hentai' || 
      g.name.toLowerCase() === 'erotica' ||
      g.russian.toLowerCase() === 'эротика' ||
      g.russian.toLowerCase() === 'хентай'
    );
    if (hasNsfwGenre) return false;
  }

  return true;
}

// --- SVG Generator (Оставляем тот же) ---
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + 1 + words[i].length <= maxCharsPerLine) {
      currentLine += ' ' + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

export function generateArtPoster(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % 4;
  const letter = title.slice(0, 1).toUpperCase();
  
  const titleLength = title.length;
  let fontSize = 36;
  let maxChars = 14;
  let lineHeight = 40;

  if (titleLength > 50) { fontSize = 22; maxChars = 24; lineHeight = 26; } 
  else if (titleLength > 25) { fontSize = 28; maxChars = 18; lineHeight = 32; }

  const lines = wrapText(title, maxChars);
  if (lines.length > 4) { lines[3] = lines[3].substring(0, lines[3].length - 3) + "..."; lines.length = 4; }

  const startY = 560 - (lines.length * lineHeight); 
  const textSvg = lines.map((line, i) => `<tspan x="40" dy="${i === 0 ? 0 : lineHeight}" font-weight="bold">${line}</tspan>`).join('');

  const styles = [
    { bg: '#1a0505', textColor: '#fed7aa', accentColor: '#ea580c' },
    { bg: '#020617', textColor: '#bfdbfe', accentColor: '#3b82f6' },
    { bg: '#1e1b4b', textColor: '#e9d5ff', accentColor: '#a78bfa' },
    { bg: '#18181b', textColor: '#e4e4e7', accentColor: '#22c55e' }
  ];
  const s = styles[index];

  const svg = `<svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${s.bg}"/><text x="50%" y="40%" font-family="sans-serif" font-weight="900" font-size="300" fill="${s.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text><rect x="25" y="${startY - 10}" width="4" height="${lines.length * lineHeight + 20}" fill="${s.accentColor}"/><text x="40" y="${startY + fontSize}" font-family="sans-serif" font-size="${fontSize}" fill="white" style="text-transform: uppercase; letter-spacing: 1px;">${textSvg}</text><text x="40" y="${startY - 20}" font-family="sans-serif" font-size="12" fill="${s.textColor}" opacity="0.6" letter-spacing="3">ANIME COLLECTION</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}