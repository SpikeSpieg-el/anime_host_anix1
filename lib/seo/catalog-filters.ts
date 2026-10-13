/**
 * Разбор параметров /catalog для SEO: чем URL фильтра отличается от дубля.
 *
 * ИСТОРИЯ ПРОБЛЕМЫ
 * ----------------
 * /catalog умеет рисовать тайтлы под фильтры («Аниме в жанре Исекай смотреть
 * онлайн…»), но canonical там был жёстко прописан на /catalog. Google отдаёт
 * такие страницы в индекс только по canonical'у, поэтому все жанровые тайтлы
 * схлопывались в один адрес и в выдаче не появлялось ничего.
 *
 * Теперь разделение ответственности такое:
 *   - один жанр без других фильтров → 301 на /genre/<slug> (см. middleware).
 *     Там уже есть нормальный лендинг с SSR-карточками и разметкой;
 *   - жанр + год (или один год) → self-canonical, это длинный хвост
 *     («аниме романтика 2024»);
 *   - всё остальное (sort, kind, status, score, search, пагинация) → canonical
 *     на голый /catalog, чтобы не плодить тысячи тонких дублей.
 *
 * Модуль без React/Next и без сети: его читают middleware (edge runtime),
 * страница каталога и тесты.
 */

import type { GenreLanding } from "@/lib/seo/genre-landings"
import { GENRE_LANDINGS, getGenreLanding } from "@/lib/seo/genre-landings"

export const CATALOG_BASE_URL = "https://weeb-x.com/catalog"

/**
 * Параметры, меняющие содержимое /catalog настолько, что страница deserves
 * собственный canonical. Остальные — служебные сортировки и пагинация.
 */
const INDEXABLE_PARAMS = new Set(["genre", "year"])

const BY_NAME = new Map(GENRE_LANDINGS.map((g) => [g.name, g]))
const BY_GENRE_ID = new Map(GENRE_LANDINGS.map((g) => [g.genreId, g]))

/**
 * Жанр по значению параметра `genre`.
 *
 * Принимает всё, чем реально пользуются: русское название из GENRES_MAP
 * («Исекай»), числовой ID Shikimori («543») и латинский slug («isekai»).
 *
 * Последнее важно: страница фильтра принимает `?genre=isekai`, но в GENRES_MAP
 * есть только «Исекай», а getAnimeCatalog делает `GENRES_MAP[g] || g` — мимо
 * карты уходит сырая строка, Shikimori её не понимает и отдаёт 0 карточек.
 * Такие ссылки раньше вели на пустую страницу.
 */
export function resolveGenreParam(value: string | null | undefined): GenreLanding | undefined {
  const raw = (value ?? "").trim()
  if (!raw || raw === "all") return undefined
  return BY_NAME.get(raw) ?? BY_GENRE_ID.get(raw) ?? getGenreLanding(raw)
}

/** Значения параметра с учётом повторов (?genre=a&genre=b). */
function singleValue(sp: URLSearchParams, key: string): string | null {
  const values = sp.getAll(key).filter((v) => v.trim() !== "")
  return values.length === 1 ? values[0].trim() : null
}

/**
 * true, если фильтры дают самостоятельную страницу с self-canonical.
 *
 * Несколько жанров или несколько лет подряд не проходят: такие комбинации
 * дают десятки почти одинаковых страниц, и индексировать их вредно.
 */
export function hasIndexableCatalogFilters(sp: URLSearchParams): boolean {
  const keys = [...new Set([...sp.keys()].filter((k) => sp.getAll(k).some((v) => v.trim() !== "")))]
  if (keys.length === 0) return false
  if (!keys.every((key) => INDEXABLE_PARAMS.has(key))) return false

  // Несколько жанров или лет — комбинация, а не страница.
  if (sp.getAll("genre").filter(Boolean).length > 1) return false
  if (sp.getAll("year").filter(Boolean).length > 1) return false

  return true
}

/**
 * Куда канонизировать /catalog с такими фильтрами.
 *
 * Название жанра приводится к русскому из GENRES_MAP, чтобы `?genre=543` и
 * `?genre=isekai` не плодили по отдельному URL — все три ведут на один.
 */
export function buildCatalogCanonical(sp: URLSearchParams): string {
  if (!hasIndexableCatalogFilters(sp)) return CATALOG_BASE_URL

  const params = new URLSearchParams()
  const genre = resolveGenreParam(singleValue(sp, "genre"))
  if (genre) params.set("genre", genre.name)
  const year = singleValue(sp, "year")
  if (year) params.set("year", year)

  const query = params.toString()
  return query ? `${CATALOG_BASE_URL}?${query}` : CATALOG_BASE_URL
}

/**
 * 301 с «чистого» фильтра одного жанра на жанровый лендинг.
 *
 * Только если кроме genre нет НИ ОДНОГО другого параметра: любая комбинация
 * (год, статус, тип) — это отдельная страница, и сворачивать её на
 * /genre/<slug> значило бы терять длинный хвост.
 */
export function resolveCatalogGenreRedirect(sp: URLSearchParams): string | null {
  const genre = resolveGenreParam(singleValue(sp, "genre"))
  if (!genre) return null

  const otherKeys = [...new Set([...sp.keys()])].filter(
    (key) => key !== "genre" && sp.getAll(key).some((v) => v.trim() !== ""),
  )
  if (otherKeys.length > 0) return null

  return `/genre/${genre.slug}`
}