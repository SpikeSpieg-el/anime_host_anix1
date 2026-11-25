/**
 * Оркестрация «умного» поиска: волны запросов к Shikimori + локальное
 * ранжирование + достройка франшизы для запросов с номером сезона.
 *
 * Почему волны, а не один запрос
 * -------------------------------
 * Shikimori ищет по Elasticsearch с оператором OR между токенами и без
 * морфологии (см. smart-search.ts). Один запрос «токийские мстители 4 сезон»
 * даёт сотни случайных тайтлов, где есть цифра 4 или слово «сезон», а
 * «мстители» не находит «мститель». Поэтому:
 *
 *   волна 1 — чистое название (+ транслит): то, что раньше делал
 *             generateSearchVariants, для латиницы это и есть нормальный
 *             запрос;
 *   волна 2 — стемминг («токийск мстител»): запускается, когда волна 1
 *             вернула мало результатов или ни один не похож на название;
 *   волна 3 — префиксы самого длинного токена: только когда пул пуст,
 *             ловит «мстителейми» и опечатки в конце слова.
 *
 * Все волны идут с limit=50 (максимум Shikimori) и без page — нам нужен
 * весь пул кандидатов, а не страница. Ранжируем локально
 * (scoreSearchCandidate), для «N сезон» достраиваем франшизу и поднимаем
 * нужную часть первой.
 *
 * Модуль намеренно отделён от api.ts: api.ts импортирует его, а не наоборот,
 * поэтому нет цикла импортов.
 */

import { BASE_URL } from "./config";
import { shikimoriJson } from "./client";
import { transformAnime } from "./transformers";
import { isAnimeSafe } from "./utils";
import type { Anime, CatalogFilters, ShikimoriAnime } from "./types";
import {
  CONFIDENT_TITLE_SCORE,
  buildPrefixQueries,
  buildStemmedQuery,
  extractSeasonFromTitle,
  generateWave1Variants,
  scoreSearchCandidate,
  titleMatchScore,
  type ParsedAnimeQuery,
} from "./smart-search";

/** Сколько максимум берём из Shikimori за один запрос волны. */
const WAVE_FETCH_LIMIT = 50;
/** Сколько кандидатов держим в пуле после ранжирования. */
const MAX_POOL = 60;

interface PoolEntry {
  item: ShikimoriAnime;
  /** Позиция в выдаче Elasticsearch (0 — первый). Меньше — лучше. */
  esRank: number;
}

interface FranchiseSeasonResult {
  /** Полная запись тайтла, который является N-м сезоном (если нашлась). */
  target: ShikimoriAnime | null;
  /** id тайтла → номер сезона внутри франшизы. */
  knownSeasons: Map<string, number>;
}

/**
 * Определяет, какой тайтл франшизы является N-м сезоном.
 *
 * Shikimori не хранит номер сезона как отдельное поле, поэтому считаем его
 * по порядку узлов франшизы (weight, затем год), а явный номер из названия
 * («Season 4», «4 сезон») используем как поправку: effective = max(явный,
 * позиция+1). Так «второй сезон» не потеряется, даже если франшиза
 * начинается со спешла.
 *
 * Возвращает null, если франшизу получить не удалось, — поиск при этом
 * просто ранжирует то, что нашёл.
 */
export async function resolveFranchiseSeason(
  baseId: number,
  season: number,
): Promise<FranchiseSeasonResult | null> {
  try {
    const data = await shikimoriJson<any | null>(
      `${BASE_URL}/animes/${baseId}/franchise`,
      { next: { revalidate: 21600 } },
      { fallback: null, ttlMs: 6 * 60 * 60_000, staleTtlMs: 24 * 60 * 60_000 },
    );
    if (!data || !Array.isArray(data.nodes)) return null;

    const nodes = data.nodes
      .map((node: any) => ({
        id: Number(node.id),
        name: typeof node.name === "string" ? node.name : "",
        russian: typeof node.russian === "string" ? node.russian : "",
        kind: typeof node.kind === "string" ? node.kind.toLowerCase() : "",
        weight: Number(node.weight) || 0,
        year: Number(node.year) || 0,
      }))
      .filter((node: { id: number }) => Number.isFinite(node.id) && node.id > 0);
    if (nodes.length === 0) return null;

    nodes.sort((a: { weight: number; year: number }, b: { weight: number; year: number }) => a.weight - b.weight || a.year - b.year);

    // Сезоны — это ТВ-части (и ONA). Если таких узлов меньше двух, расширяем
    // список: сначала OVA, затем всё кроме музыкальных клипов.
    let list = nodes.filter((node: { kind: string }) => node.kind === "tv" || node.kind === "ona");
    if (list.length < 2) {
      list = nodes.filter((node: { kind: string }) => ["tv", "ona", "ova"].includes(node.kind));
    }
    if (list.length < 2) {
      list = nodes.filter((node: { kind: string }) => node.kind !== "music");
    }
    if (list.length === 0) return null;

    const knownSeasons = new Map<string, number>();
    const effective = list.map((node: { id: number; name: string; russian: string }, index: number) => {
      const explicit = extractSeasonFromTitle(`${node.russian} ${node.name}`);
      const value = Math.max(explicit ?? 0, index + 1);
      knownSeasons.set(String(node.id), value);
      return { id: node.id, value };
    });

    const targetNode = effective.find((entry: { value: number }) => entry.value === season);
    if (!targetNode) return { target: null, knownSeasons };

    const record = await shikimoriJson<ShikimoriAnime | null>(
      `${BASE_URL}/animes/${targetNode.id}`,
      { next: { revalidate: 1800 } },
      { fallback: null, ttlMs: 30 * 60_000, staleTtlMs: 60 * 60_000 },
    );
    if (!record) return { target: null, knownSeasons };

    return { target: record, knownSeasons };
  } catch {
    return null;
  }
}

/**
 * Умный поиск по каталогу. Вызывается из getAnimeCatalog, когда из запроса
 * удалось вытащить название (parsed.tokens не пуст).
 */
export async function smartAnimeSearch(
  filters: CatalogFilters,
  baseParams: URLSearchParams,
  parsed: ParsedAnimeQuery,
): Promise<Anime[]> {
  const limit = filters.limit ?? 24;
  const page = filters.page ?? 1;
  const allowNsfw = filters.allowNsfw ?? false;

  const pool = new Map<number, PoolEntry>();
  const fetchedTerms = new Set<string>();

  const addToPool = (items: ShikimoriAnime[]) => {
    items.forEach((item, index) => {
      if (!item || typeof item.id !== "number") return;
      if (!allowNsfw && !isAnimeSafe(item)) return;
      const existing = pool.get(item.id);
      if (!existing) {
        pool.set(item.id, { item, esRank: index });
      } else if (index < existing.esRank) {
        existing.esRank = index;
      }
    });
  };

  const fetchWave = async (terms: string[]): Promise<void> => {
    const freshTerms = terms.filter((term) => term && !fetchedTerms.has(term));
    if (freshTerms.length === 0) return;
    freshTerms.forEach((term) => fetchedTerms.add(term));

    const results = await Promise.all(
      freshTerms.map((term) => {
        const params = new URLSearchParams(baseParams);
        params.delete("page");
        params.set("limit", String(WAVE_FETCH_LIMIT));
        params.set("search", term);
        return shikimoriJson<ShikimoriAnime[]>(
          `${BASE_URL}/animes?${params.toString()}`,
          { next: { revalidate: 60 } },
          { fallback: [], ttlMs: 2 * 60_000, staleTtlMs: 30 * 60_000 },
        );
      }),
    );
    results.forEach((items) => {
      if (Array.isArray(items)) addToPool(items);
    });
  };

  const maxTitleMatchScore = (): number => {
    let best = 0;
    pool.forEach(({ item }) => {
      best = Math.max(best, titleMatchScore(item, parsed));
    });
    return best;
  };

  // Волна 1: название + транслит (прежнее поведение, без регрессии).
  await fetchWave(generateWave1Variants(parsed));

  // Волна 2: стемминг. Нужна, когда пул маленький или в нём нет ни одного
  // тайтла, похожего на название (OR-выдача Shikimori любит мусор).
  if (pool.size < Math.min(limit, 12) || maxTitleMatchScore() < CONFIDENT_TITLE_SCORE) {
    await fetchWave([buildStemmedQuery(parsed)]);
  }

  // Волна 3: префиксы — только если вообще ничего не нашли.
  if (pool.size === 0) {
    await fetchWave(buildPrefixQueries(parsed));
  }

  // Запрос с номером сезона: достраиваем франшизу по лучшему совпадению
  // названия и поднимаем нужную часть первой.
  let knownSeasons: Map<string, number> | undefined;
  let targetId: string | undefined;

  if (parsed.season != null && pool.size > 0) {
    let bestScore = 0;
    const bestItem = Array.from(pool.values()).reduce<ShikimoriAnime | null>((best, { item }) => {
      const score = titleMatchScore(item, parsed);
      if (score > bestScore) {
        bestScore = score;
        return item;
      }
      return best;
    }, null);

    if (bestItem && bestScore >= CONFIDENT_TITLE_SCORE) {
      const franchise = await resolveFranchiseSeason(bestItem.id, parsed.season);
      if (franchise) {
        knownSeasons = franchise.knownSeasons;
        if (franchise.target) {
          targetId = String(franchise.target.id);
          if (!allowNsfw && !isAnimeSafe(franchise.target)) {
            targetId = undefined;
          } else if (!pool.has(franchise.target.id)) {
            pool.set(franchise.target.id, { item: franchise.target, esRank: -1 });
          }
        }
      }
    }
  }

  const ranked = Array.from(pool.values())
    .map((entry) => ({
      ...entry,
      score: scoreSearchCandidate(
        entry.item,
        { parsed, knownSeasons, targetId },
        entry.esRank,
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.esRank - b.esRank ||
        (Number.parseFloat(b.item.score) || 0) - (Number.parseFloat(a.item.score) || 0),
    )
    .slice(0, MAX_POOL);

  const start = Math.max(0, (page - 1) * limit);
  const pageSlice = ranked.slice(start, start + limit);

  // transformAnime может ходить во внешние API за обложкой — трансформируем
  // только итоговую страницу, а не весь пул.
  return await Promise.all(
    pageSlice.map((entry) => transformAnime(entry.item, filters.enableGenreFallback, filters.disableExternalAPIs)),
  );
}
