import { describe, expect, it } from "vitest"
import { GENRES_MAP } from "@/lib/shikimori/config"
import { PAGES } from "../../registry/pages"
import {
  GENRE_LANDINGS,
  GENRE_PATH_ALIASES,
  INDEXABLE_GENRE_LANDINGS,
  buildGenreDescription,
  buildGenreTitle,
  getGenreLanding,
  getGenrePath,
  resolveGenreAlias,
} from "@/lib/seo/genre-landings"

describe("жанровые лендинги", () => {
  it("есть лендинг на каждый жанр из GENRES_MAP", () => {
    expect(GENRE_LANDINGS).toHaveLength(Object.keys(GENRES_MAP).length)
    expect(GENRE_LANDINGS.map((g) => g.name)).toEqual(Object.keys(GENRES_MAP))
  })

  it("slug'ы уникальны — иначе один жанр перетирал бы другой в generateStaticParams", () => {
    const slugs = GENRE_LANDINGS.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("slug'ы латинские, без пробелов и юникода — иначе sitemap-валидатор Яндекса отвергнет URL", () => {
    for (const genre of GENRE_LANDINGS) {
      expect(genre.slug).toMatch(/^[a-z0-9-]+$/)
      expect(genre.slug).not.toContain("--")
      expect(getGenrePath(genre.slug)).toBe(`/genre/${genre.slug}`)
    }
  })

  it("транслитерация даёт ожидаемые адреса для жанров из реальных запросов", () => {
    expect(getGenreLanding("isekai")?.name).toBe("Исекай")
    expect(getGenreLanding("romantika")?.name).toBe("Романтика")
    expect(getGenreLanding("komediya")?.name).toBe("Комедия")
  })

  it("жанры-демографики адресуются устоявшимся написанием, а не транслитерацией", () => {
    // Механическая транслитерация дала бы senen/sesen/josei-j — такие адреса
    // никто не пишет и по ним нет ссылок.
    expect(getGenreLanding("shonen")?.name).toBe("Сёнэн")
    expect(getGenreLanding("seinen")?.name).toBe("Сэйнэн")
    expect(getGenreLanding("shojo")?.name).toBe("Сёдзё")
    expect(getGenreLanding("josei")?.name).toBe("Дзёсэй")
  })

  it("неизвестный slug не подставляет никакой жанр (иначе 404 не отдаётся)", () => {
    expect(getGenreLanding("")).toBeUndefined()
    expect(getGenreLanding(undefined)).toBeUndefined()
    expect(getGenreLanding("anime-123")).toBeUndefined()
    // Транслитерация «Исекай» дала бы isekay — такого адреса у нас нет.
    expect(getGenreLanding("isekay")).toBeUndefined()
  })

  it("18+ жанры остаются в роуте, но не индексируются", () => {
    // Хентай (12) и эротика (9) — по политике сайта такие тайтлы отдаются
    // с noindex и на /watch, поэтому лендинги под них не анонсируем.
    for (const genreId of ["12", "9"]) {
      const genre = GENRE_LANDINGS.find((g) => g.genreId === genreId)
      expect(genre).toBeDefined()
      expect(genre?.indexable).toBe(false)
      // Из sitemap и хаба /genre они выпадают.
      expect(INDEXABLE_GENRE_LANDINGS.some((g) => g.slug === genre?.slug)).toBe(false)
    }
    expect(INDEXABLE_GENRE_LANDINGS.length).toBe(GENRE_LANDINGS.length - 2)
  })
})

describe("короткие адреса жанров (/isekai → /genre/isekai)", () => {
  it("алиас ведёт на канонический лендинг", () => {
    expect(resolveGenreAlias("/isekai")).toBe("/genre/isekai")
    expect(resolveGenreAlias("/romantika")).toBe("/genre/romantika")
  })

  it("ловит варианты написания, по которым на нас уже ссылаются", () => {
    // Механическая транслитерация «Исекай» даёт isekay, а не isekai.
    expect(resolveGenreAlias("/isekay")).toBe("/genre/isekai")
    expect(resolveGenreAlias("/isjekaj")).toBe("/genre/isekai")
    expect(resolveGenreAlias("/romance")).toBe("/genre/romantika")
    expect(resolveGenreAlias("/seynen")).toBe("/genre/seinen")
  })

  it("терпит регистр и хвостовые слеши", () => {
    expect(resolveGenreAlias("/Isekai/")).toBe("/genre/isekai")
    expect(resolveGenreAlias("//isekai//")).toBe("/genre/isekai")
  })

  it("не отдаёт редирект ни на что, кроме жанров", () => {
    for (const path of ["/", "/catalog", "/watch/21-one-piece", "/khentay", "/ishi-123", "/isekai/extra"]) {
      expect(resolveGenreAlias(path), path).toBeNull()
    }
    expect(resolveGenreAlias("")).toBeNull()
  })

  it("ни один алиас не пересекается с настоящим маршрутом сайта", () => {
    // Иначе короткий адрес жанра молча перехватил бы реальную страницу.
    const routes = new Set(
      PAGES.map((page) => page.route.replace(/:[^/]+/, "").replace(/\/$/, "")),
    )
    const collisions = Object.keys(GENRE_PATH_ALIASES).filter((alias) => routes.has(`/${alias}`))
    expect(collisions).toEqual([])
  })

  it("18+ жанры не получают алиасов даже через 301", () => {
    expect(Object.values(GENRE_PATH_ALIASES)).not.toContain("khentay")
    expect(resolveGenreAlias("/khentay")).toBeNull()
  })

  it("алиасов больше, чем жанров: за счёт вариантов написания", () => {
    expect(Object.keys(GENRE_PATH_ALIASES).length)
      .toBeGreaterThan(INDEXABLE_GENRE_LANDINGS.length)
  })
})

describe("title и description жанра", () => {
  const isekai = getGenreLanding("isekai")!

  it("title дословно содержит запрос «смотреть исекай» и бренд", () => {
    const title = buildGenreTitle(isekai)
    expect(title).toContain("Смотреть Исекай аниме")
    expect(title).toContain("Weebx")
    // Google режет по ~600 символам — держим заголовок коротким.
    expect(title.length).toBeLessThan(120)
  })

  it("description вставляет реальное число тайтлов и ключевые слова жанра", () => {
    const withCount = buildGenreDescription(isekai, 24)
    expect(withCount).toContain("24 аниме")
    expect(withCount).toContain("попаданцев в другой мир")
    expect(withCount).toContain("русской озвучкой")
  })

  it("без числа тайтлов description не врёт про количество", () => {
    expect(buildGenreDescription(isekai, 0)).toContain("Аниме в жанре")
    expect(buildGenreDescription(isekai)).not.toContain("аниме в жанре 0")
  })

  it("у каждого жанра есть своя подсказка — одинаковые description'ы это дубли", () => {
    const descriptions = new Set(GENRE_LANDINGS.map((g) => buildGenreDescription(g, 10)))
    expect(descriptions.size).toBe(GENRE_LANDINGS.length)
  })
})