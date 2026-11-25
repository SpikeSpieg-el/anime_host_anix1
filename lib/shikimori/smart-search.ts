/**
 * «Очень умный» поиск: разбираем тупые запросы и ранжируем выдачу.
 *
 * Почему это вообще нужно
 * -----------------------
 * Shikimori ищет через Elasticsearch (см. shikimori/shikimori:
 * app/services/elasticsearch/query/query_base.rb), и это важно понимать:
 *
 *  1. Токены запроса объединяются оператором OR — любое совпадение тянет
 *     документ. Поэтому «4 сезон» в запросе даёт сотни случайных тайтлов,
 *     где есть просто цифра 4 или слово «сезон».
 *  2. Морфологии в индексЕ НЕТ (analyzers: lowercase + asciifolding +
 *     synonyms + ngram/edge_ngram, без стеммера). «мстители» никогда не
 *     совпадёт с «мститель», «токийские» — с «токийский».
 *  3. ngram-поле индексирует ВСЕ подстроки слова (min_gram 1), edge_word —
 *     все префиксы. То есть запрос «мстител» находит «мститель» ✓.
 *
 * Отсюда стратегия:
 *   - вырезаем из запроса мусор («4 сезон», год, «фильм», стоп-слова);
 *   - строим волны запросов: сырое название → стемминг → префиксы;
 *   - локально ранжируем, явно учитывая нужный сезон и опечатки;
 *   - для запросов с сезоном достраиваем франшизу и поднимаем нужную часть.
 *
 * Модуль чистый (без сетевых запросов) — его можно импортировать и на
 * клиенте, и в тестах.
 */

import type { ShikimoriAnime } from "./types";
import { containsCyrillic, generateSearchVariants } from "./utils";

// ---------------------------------------------------------------------------
// Нормализация и стемминг
// ---------------------------------------------------------------------------

/** Нормализуем текст для сравнения: нижний регистр, ё→е, всё кроме букв/цифр — пробел. */
export function normalizeSearchText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^0-9a-zа-я]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Русские окончания для стемминга, от длинных к коротким.
 *
 * Индекс Shikimori не стеммит, но зато ищет по подстроке слова, поэтому
 * достаточно отрезать окончание: «мстители» → «мстител» ⊂ «мститель»,
 * «титанов» → «титан» ⊂ «титанов», «токийских» → «токийск» ⊂ «токийский».
 */
const RU_ENDINGS = [
  "иями", "ами", "ями", "ого", "его", "ому", "ему", "ыми", "ими",
  "иях", "иям", "иев", "ией",
  "ов", "ев", "ей", "ах", "ях", "ам", "ям", "ых", "их", "ым", "им", "ую",
  "ия", "ие", "ые", "ый", "ий", "ой", "ая", "ое",
  "ы", "и", "а", "я", "ь", "ъ",
].sort((a, b) => b.length - a.length);

/** Минимальная длина слова, с которого вообще имеет смысл срезать окончание. */
const MIN_STEM_SOURCE_LEN = 6;
/** Минимальная длина стема: короче — слишком много шума в выдаче. */
const MIN_STEM_LEN = 4;

/**
 * Стем одного токена. Для кириллицы срезаем одно окончание, для латиницы —
 * единственную «s» в конце (titans → titan, revengers → revenger).
 *
 * Стем всегда является префиксом исходного слова, а значит совпадение
 * «стем ⊂ заголовок» включает в себя и совпадение «оригинал ⊂ заголовок» —
 * то есть стем-запрос никогда не хуже исходного по найденным документам.
 */
export function stemSearchToken(token: string): string {
  if (!token) return token;

  if (containsCyrillic(token)) {
    if (token.length < MIN_STEM_SOURCE_LEN) return token;
    for (const ending of RU_ENDINGS) {
      if (token.length - ending.length >= MIN_STEM_LEN && token.endsWith(ending)) {
        return token.slice(0, token.length - ending.length);
      }
    }
    return token;
  }

  if (token.length >= 5 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

// ---------------------------------------------------------------------------
// Разбор запроса
// ---------------------------------------------------------------------------

/** Стоп-слова: всё, что не помогает найти тайтл, а только мусорит в OR-выдаче. */
const STOP_WORDS = new Set([
  // русские служебные
  "аниме", "смотреть", "смотретьонлайн", "онлайн", "бесплатно", "бесплатное",
  "бесплатная", "качество", "хорошем", "качестве", "сериал", "сериалы",
  "тайтл", "в", "во", "и", "а", "но", "или", "на", "с", "со", "у", "о",
  "об", "от", "до", "для", "по", "из", "при", "под", "над", "между", "без",
  "через", "про", "что", "кто", "как", "где", "когда", "чем", "это", "этот",
  "эта", "эти", "тот", "та", "те", "его", "её", "ее", "их", "наш", "мой",
  "свой", "который", "которая", "которое", "которые",
  // английские служебные
  "the", "of", "and", "or", "for", "with", "in", "on", "at", "to", "from",
  "by", "my", "your", "anime", "series", "movie", "season",
  // технический мусор
  "hd", "hdrip", "webrip", "bluray", "online",
]);

/** Подсказки по типу: «фильм», «ova»… Вырезаем из запроса и помним. */
const KIND_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:movie|movies|фильм|фильмы|фильма)\b/i, "movie"],
  [/\b(?:ova|ова)\b/i, "ova"],
  [/\b(?:ona|она)\b/i, "ona"],
  [/\b(?:special|спешл|спешлы|спешл)\b/i, "special"],
  [/\b(?:tv|сериал|сериалы|сериалов)\b/i, "tv"],
];

const ROMAN_TO_NUMBER: Record<string, number> = {
  ii: 2, iii: 3, iv: 4, vi: 6, vii: 7, viii: 8, ix: 9, xi: 11, xii: 12,
};

const RU_ORDINAL_PREFIXES: Array<[string, number]> = [
  ["перв", 1], ["втор", 2], ["трет", 3], ["четверт", 4], ["пят", 5],
  ["шест", 6], ["седьм", 7], ["восьм", 8], ["девят", 9], ["десят", 10],
];

type SeasonPattern = { re: RegExp; type: "num" | "roman" | "ordinal" };

/**
 * Паттерны «сезона» в запросе И в названиях тайтлов.
 * Порядок важен: сначала явные маркеры («4 сезон»), потом хвостовые цифры.
 *
 * Одиночные римские i/v/x не используем — слишком легко поймать мусор
 * («… Part V» в названиях фильмов, латинские слова).
 */
const SEASON_PATTERNS: SeasonPattern[] = [
  // «сезон 4», «season 4», «сез 4»
  { re: /(?<![0-9a-zа-я])(?:season|сезон|сез)\s*[-–—]?\s*(\d{1,2})(?![0-9a-zа-я])/i, type: "num" },
  // «4 сезон», «4-й сезон», «4th season»
  {
    re: /(?<![0-9a-zа-я])(\d{1,2})\s*[-–—]?\s*(?:st|nd|rd|th)?\s*(?:й|ый|ой|ий)?\s*(?:season|сезон|сез)(?![0-9a-zа-я])/i,
    type: "num",
  },
  // «второй сезон», «четвёртый сезон»
  {
    re: /(?<![0-9a-zа-я])(перв|втор|трет|четверт|пят|шест|седьм|восьм|девят|десят)(?:ой|ый|ий)\s+(?:season|сезон|сез)(?![0-9a-zа-я])/i,
    type: "ordinal",
  },
  // «season iv», «part iv»
  {
    re: /\b(?:season|сезон|part|часть|том|cour)\s*[-–—]?\s*(xii|xi|viii|vii|vi|iv|iii|ii|ix)\b/i,
    type: "roman",
  },
  // «4 часть», «часть 4», «part 2», «том 3», «cour 2»
  { re: /\b(?:part|часть|том|cour)\s*[-–—]?\s*(\d{1,2})\b/i, type: "num" },
  {
    re: /\b(\d{1,2})\s*[-–—]?\s*(?:st|nd|rd|th)?\s*(?:й|ый|ой|ий)?\s*(?:part|часть|том|cour)\b/i,
    type: "num",
  },
  // хвостовая цифра: «название 4». 0 и трёхзначные числа не трогаем —
  // это не сезон («Steins;Gate 0», «Моб Психо 100»).
  { re: /(?:^|\s)([1-9]|1[0-6])\s*$/, type: "num" },
  // хвостовая римская: «название IV»
  { re: /\s(xii|xi|viii|vii|vi|iv|iii|ii|ix)\s*$/i, type: "roman" },
];

function seasonValueFromMatch(match: RegExpExecArray, type: SeasonPattern["type"]): number | null {
  const raw = (match[1] || "").toLowerCase();
  let value: number | null = null;
  if (type === "num") value = Number.parseInt(raw, 10);
  else if (type === "roman") value = ROMAN_TO_NUMBER[raw] ?? null;
  else {
    const hit = RU_ORDINAL_PREFIXES.find(([prefix]) => raw.startsWith(prefix));
    value = hit ? hit[1] : null;
  }
  if (value == null || Number.isNaN(value) || value < 1 || value > 20) return null;
  return value;
}

/**
 * Вырезает из строки все упоминания сезона/части и возвращает первое
 * найденное число. Работает на строке с ё→е: длины совпадают, поэтому
 * индексы совпадений можно применять и к оригиналу.
 */
function extractSeasonMarkers(work: string): { season: number | null; rest: string; markers: string[] } {
  let rest = work;
  let season: number | null = null;
  const markers: string[] = [];

  for (let guard = 0; guard < 4; guard++) {
    let matched = false;
    for (const { re, type } of SEASON_PATTERNS) {
      // Индексы считаем по строке с ё→е, вырезаем по rest — длины одинаковы,
      // поэтому позиции совпадений совпадают с позициями в оригинале.
      const currentHaystack = rest.replace(/[ёЁ]/g, "е");
      const match = re.exec(currentHaystack);
      if (!match) continue;
      const value = seasonValueFromMatch(match, type);
      if (value == null) continue;
      rest = rest.slice(0, match.index) + " " + rest.slice(match.index + match[0].length);
      markers.push(match[0].trim().replace(/\s+/g, " "));
      if (season == null) season = value;
      matched = true;
      break;
    }
    if (!matched) break;
  }

  return { season, rest, markers };
}

function extractKindMarker(work: string): { kind: string | null; rest: string; marker: string | null } {
  for (const [re, kind] of KIND_PATTERNS) {
    const match = re.exec(work);
    if (!match) continue;
    const candidate = work.slice(0, match.index) + " " + work.slice(match.index + match[0].length);
    // Вырезаем тип только если название не исчезло целиком:
    // запрос «movie» сам по себе обязан остаться запросом «movie».
    if (normalizeSearchText(candidate).length >= 3) {
      return { kind, rest: candidate, marker: match[0].trim() };
    }
  }
  return { kind: null, rest: work, marker: null };
}

function extractYearMarker(work: string): { year: number | null; rest: string; marker: string | null } {
  const match = /\b(19\d{2}|20\d{2})\b/.exec(work);
  if (!match) return { year: null, rest: work, marker: null };
  const candidate = work.slice(0, match.index) + " " + work.slice(match.index + match[0].length);
  if (normalizeSearchText(candidate).length >= 3) {
    return { year: Number.parseInt(match[1], 10), rest: candidate, marker: match[1] };
  }
  return { year: null, rest: work, marker: null };
}

export interface ParsedAnimeQuery {
  /** Оригинальный запрос пользователя, как есть. */
  raw: string;
  /** Название без «4 сезон», года, типа и стоп-слов (для поиска, нижний регистр). */
  title: string;
  /** То же, но с сохранением регистра — для подсказки пользователю. */
  titleDisplay: string;
  /** Токены title (нижний регистр, через пробел). */
  tokens: string[];
  /** Название, пропущенное через стемминг — запрос к Shikimori из волны 2. */
  stemmedTitle: string;
  season: number | null;
  year: number | null;
  kind: string | null;
  /** Что вырезали из запроса («4 сезон», «2015», «фильм») — для подсказки. */
  markers: string[];
}

function tokenizeKeepCase(text: string): string[] {
  return text.split(/[^0-9A-Za-zА-Яа-яЁё]+/).filter(Boolean);
}

/**
 * Главный разбор запроса: «токийские мстители 4 сезон» →
 * { title: "токийские мстители", season: 4, markers: ["4 сезон"] }.
 *
 * Пустое title означает, что из запроса нечего вытащить (например, «4 сезон»
 * без названия) — вызывающая сторона в таком случае ищет как есть.
 */
export function parseAnimeQuery(raw: string): ParsedAnimeQuery {
  const input = (raw || "").trim();
  const markers: string[] = [];

  const seasonRes = extractSeasonMarkers(input);
  const kindRes = extractKindMarker(seasonRes.rest);
  const yearRes = extractYearMarker(kindRes.rest);

  markers.push(...seasonRes.markers);
  if (kindRes.marker) markers.push(kindRes.marker);
  if (yearRes.marker) markers.push(yearRes.marker);

  const tokens = tokenizeKeepCase(yearRes.rest).filter((token) => {
    if (token.length <= 1) return false;
    const normalized = normalizeSearchText(token);
    if (!normalized) return false;
    return !STOP_WORDS.has(normalized);
  });

  const titleDisplay = tokens.join(" ");
  const title = normalizeSearchText(titleDisplay);
  const titleTokens = title ? title.split(" ") : [];
  const stemmedTitle = Array.from(
    new Set(titleTokens.filter((t) => t.length >= 3).map(stemSearchToken)),
  )
    .filter((t) => t.length >= 3)
    .join(" ");

  return {
    raw: input,
    title,
    titleDisplay,
    tokens: titleTokens,
    stemmedTitle,
    season: seasonRes.season,
    year: yearRes.year,
    kind: kindRes.kind,
    markers: Array.from(new Set(markers.filter(Boolean))),
  };
}

// ---------------------------------------------------------------------------
// Волны запросов
// ---------------------------------------------------------------------------

/**
 * Волна 1: чистое название + транслит (ровно то, что раньше делал
 * generateSearchVariants). Для латиницы стемминг обычно ничего не меняет,
 * поэтому волна 1 и есть «нормальный» запрос.
 */
export function generateWave1Variants(parsed: ParsedAnimeQuery): string[] {
  return Array.from(
    new Set(
      generateSearchVariants(parsed.title)
        .map((variant) => variant.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Волна 2: стемминг. Нужна, когда волна 1 вернула мало результатов или ни
 * один результат не похож на настоящее название (см. titleMatchScore).
 */
export function buildStemmedQuery(parsed: ParsedAnimeQuery): string {
  return parsed.stemmedTitle;
}

/**
 * Волна 3: обрезаем хвост самого длинного токена. Ловим случаи вроде
 * «мстителейми» (лишние буквы в конце) и опечаток в конце слова.
 * Работает только когда вообще ничего не нашли.
 */
export function buildPrefixQueries(parsed: ParsedAnimeQuery, maxQueries = 3): string[] {
  const candidates = Array.from(
    new Set(parsed.tokens.filter((token) => token.length >= 4).map(stemSearchToken)),
  )
    .filter((token) => token.length >= 5)
    .sort((a, b) => b.length - a.length);

  const longest = candidates[0];
  if (!longest) return [];

  const queries: string[] = [];
  for (const cut of [1, 2, 3]) {
    const query = longest.slice(0, longest.length - cut);
    if (query.length >= 4 && !queries.includes(query)) queries.push(query);
    if (queries.length >= maxQueries) break;
  }
  return queries;
}

// ---------------------------------------------------------------------------
// Локальное ранжирование
// ---------------------------------------------------------------------------

/** Насколько уверенно нужно совпадение названия, чтобы строить франшизу. */
export const CONFIDENT_TITLE_SCORE = 300;

function candidateTitleTexts(item: ShikimoriAnime): string[] {
  const collect = (value: string | string[] | null | undefined): string[] => {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
    if (typeof value === "string") return [value];
    return [];
  };

  const texts: string[] = [];
  for (const value of [
    ...collect(item.russian),
    ...collect(item.name),
    ...collect(item.english),
    ...collect(item.japanese),
  ]) {
    const normalized = normalizeSearchText(value);
    if (normalized) texts.push(normalized);
  }
  return Array.from(new Set(texts));
}

/** Расстояние Левенштейна с ранним выходом на слишком разных строках. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = current;
  }
  return prev[b.length];
}

/** 1 — строки совпадают, 0 — слишком разные. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const distance = editDistance(a, b);
  if (distance >= 99) return 0;
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Насколько кандидат похож на название из запроса (0..1000+).
 * Считаем по сырым токенам и по стемам — покрывает и опечатки, и
 * «мстители» vs «мститель».
 */
export function titleMatchScore(item: ShikimoriAnime, parsed: ParsedAnimeQuery): number {
  const texts = candidateTitleTexts(item);
  const query = parsed.title;
  if (!query || texts.length === 0) return 0;

  let best = 0;

  for (const text of texts) {
    if (text === query) best = Math.max(best, 1000);
    else if (query.length >= 3 && text.includes(query)) best = Math.max(best, 650 + Math.min(query.length, 20));
    else if (text.length >= 4 && query.includes(text)) best = Math.max(best, 560);
  }

  if (parsed.tokens.length > 0) {
    let matched = 0;
    for (const token of parsed.tokens) {
      const forms = Array.from(new Set([token, stemSearchToken(token)]));
      if (texts.some((text) => forms.some((form) => form.length >= 2 && text.includes(form)))) {
        matched++;
      }
    }
    if (matched > 0) best = Math.max(best, Math.round((450 * matched) / parsed.tokens.length));
  }

  // Опечатки: «наруту» vs «наруто», «титанн» vs «титанов».
  if (best < 450) {
    let fuzzy = 0;
    for (const text of texts) {
      const words = text.split(" ");
      for (const token of parsed.tokens) {
        if (token.length < 4) continue;
        for (const word of words) {
          if (word.length < 4) continue;
          fuzzy = Math.max(fuzzy, similarity(token, word));
        }
      }
    }
    if (fuzzy >= 0.7) best = Math.max(best, Math.round(320 * fuzzy));
  }

  return best;
}

/**
 * Номер сезона, который написан в названии тайтла: «Season 4», «4 сезон»,
 * «второй сезон», «название IV», «название 2».
 */
export function extractSeasonFromTitle(text: string): number | null {
  const normalized = normalizeSearchText(text);
  if (!normalized) return null;
  for (const { re, type } of SEASON_PATTERNS) {
    const match = re.exec(normalized);
    if (!match) continue;
    const value = seasonValueFromMatch(match, type);
    if (value != null) return value;
  }
  return null;
}

export interface SearchRankContext {
  parsed: ParsedAnimeQuery;
  /** id тайтла → номер сезона внутри франшизы (заполняет search-engine). */
  knownSeasons?: ReadonlyMap<string, number>;
  /** id тайтла, который точно соответствует «N сезону» — он идёт первым. */
  targetId?: string;
}

/**
 * Итоговый балл кандидата.
 *
 * Порядок влияет на выдачу так, как ожидает пользователь:
 *   - точное совпадение названия важнее любого сезона;
 *   - «4 сезон» в запросе поднимает нужную часть и опускает остальные;
 *   - тайтл из франшизы, выбранный как N-й сезон, всегда первый.
 */
export function scoreSearchCandidate(
  item: ShikimoriAnime,
  context: SearchRankContext,
  esRank = 0,
): number {
  const { parsed } = context;
  let score = titleMatchScore(item, parsed);

  // Нашли только по скрытым полям индекса (synonyms_*, license_name_ru) —
  // не роняем такой тайтл в ноль, но и наверх не поднимаем.
  if (score === 0) score -= 250;

  if (parsed.season != null) {
    const id = String(item.id);
    const known = context.knownSeasons?.get(id);
    const fromTitle = extractSeasonFromTitle(
      `${item.russian || ""} ${item.name || ""} ${Array.isArray(item.english) ? item.english.join(" ") : item.english || ""}`,
    );
    const candidateSeason = known ?? fromTitle;

    if (candidateSeason === parsed.season) score += 900;
    else if (candidateSeason != null) score -= 500;
    else if (parsed.season === 1) score += 100;
    else score -= 150;
  }

  if (parsed.year != null && item.aired_on) {
    const year = new Date(item.aired_on).getUTCFullYear();
    if (!Number.isNaN(year)) {
      const delta = Math.abs(year - parsed.year);
      score += delta === 0 ? 250 : delta === 1 ? 100 : -60;
    }
  }

  if (parsed.kind) score += (item.kind || "") === parsed.kind ? 200 : -150;

  if (context.targetId && String(item.id) === context.targetId) score += 2000;

  // Тай-брейк: рейтинг Shikimori, затем порядок из Elasticsearch.
  score += (Number.parseFloat(item.score) || 0) * 3;
  score -= esRank;

  return score;
}

// ---------------------------------------------------------------------------
// Подсказка пользователю
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<string, string> = {
  movie: "фильм",
  ova: "OVA",
  ona: "ONA",
  special: "спешл",
  tv: "сериал",
};

/**
 * Короткая человеческая подсказка о том, что поиск понял из запроса:
 *   «Искали по названию «токийские мстители», учли «4 сезон»».
 * null — если понимать нечего (запрос совпадает с тем, что ушло в поиск).
 */
export function buildSearchNotice(rawQuery: string): string | null {
  const parsed = parseAnimeQuery(rawQuery || "");
  const parts: string[] = [];

  const rawNormalized = normalizeSearchText(parsed.raw);
  if (parsed.title && parsed.title !== rawNormalized) {
    parts.push(`Искали по названию «${parsed.titleDisplay}»`);
  }

  const understood: string[] = [];
  if (parsed.markers.length) understood.push(`«${parsed.markers.join(", ")}»`);
  if (parsed.year != null && !parsed.markers.includes(String(parsed.year))) {
    understood.push(`«${parsed.year}»`);
  }
  if (parsed.kind && !parsed.markers.some((marker) => marker.toLowerCase() === parsed.kind)) {
    understood.push(KIND_LABELS[parsed.kind] || parsed.kind);
  }
  if (understood.length) parts.push(`учли ${understood.join(", ")}`);

  if (!parts.length) return null;
  return `${parts.join(", ")}.`;
}
