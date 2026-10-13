import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { safeSerializeJson } from "@/lib/seo/safe-json"
import { GenrePill } from "@/components/genre/genre-pill"
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs"
import {
  INDEXABLE_GENRE_LANDINGS,
  getGenrePath,
} from "@/lib/seo/genre-landings"

const SITE_URL = "https://weeb-x.com"

export const revalidate = 86400

const TITLE = "Жанры аниме — смотреть аниме онлайн бесплатно по жанрам | Weebx"
const DESCRIPTION =
  "Все жанры аниме в одном месте: исекай, романтика, фэнтези, комедия, боевик, фантастика и другие. Выбери жанр и смотри аниме онлайн бесплатно в HD с русской озвучкой на Weebx."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // SELF-canonical. Страница жанров — не дубль /catalog: под неё есть
  // собственный запрос («жанры аниме смотреть»).
  alternates: { canonical: `${SITE_URL}/genre` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_URL}/genre`,
    siteName: "Weebx",
    locale: "ru_RU",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Жанры аниме на Weebx",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
  },
}

export default function GenresPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Жанры аниме",
      "description": DESCRIPTION,
      "url": `${SITE_URL}/genre`,
      inLanguage: "ru",
      isPartOf: { "@type": "WebSite", "name": "Weebx", "url": SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Жанры аниме на Weebx",
      numberOfItems: INDEXABLE_GENRE_LANDINGS.length,
      itemListElement: INDEXABLE_GENRE_LANDINGS.map((genre, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: genre.name,
        item: `${SITE_URL}${getGenrePath(genre.slug)}`,
      })),
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeSerializeJson(data) }}
        />
      ))}

      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      {/* Отступ снизу — на обёртке контента, а не на <main>.
          <Footer/> лежит ВНУТРИ main, поэтому pb-* на main уезжает под футер
          и на зазор между контентом и футером не влияет: без этого последний
          ряд плашек/кнопка прилипали к границе футера вплотную.
          Горизонтальные px-* переехали сюда же, раз обёртка стала отвечать за
          ритм по вертикали. */}
      <div className="relative z-10 px-3 pt-6 pb-12 sm:px-4 sm:pt-10 sm:pb-16">
        <div className="container mx-auto">
          <PageBreadcrumbs
            className="mb-5"
            items={[
              { label: "Главная", href: "/" },
              { label: "Жанры" },
            ]}
          />

          {/* Заголовок с мягким свечением — визуальный якорь страницы */}
          <header className="relative mb-10 sm:mb-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 h-56 w-[36rem] max-w-[120%] -translate-x-1/2 rounded-full bg-primary/20 blur-[100px] dark:bg-orange-500/10"
            />
            <div className="relative">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-orange-500" />
                {INDEXABLE_GENRE_LANDINGS.length} жанров
              </span>

              <h1 className="text-3xl font-black tracking-tight leading-[1.1] text-foreground sm:text-5xl lg:text-6xl dark:text-white">
                Жанры аниме — <span className="text-primary dark:text-orange-500">смотреть</span> онлайн бесплатно
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base dark:text-zinc-400">
                Выбери жанр и смотри аниме в хорошем качестве HD с русской озвучкой и
                субтитрами. Бесплатно, без регистрации, новые серии появляются каждый
                день.
              </p>
            </div>
          </header>

          {/* Облако плашек. Не сетка квадратов: длинные жанры вроде
              «Сверхъестественное» и «Боевые искусства» иначе ломаются. */}
          <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
            {INDEXABLE_GENRE_LANDINGS.map((genre) => (
              <li key={genre.slug}>
                <GenrePill genre={genre} size="lg" />
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-col items-center gap-4">
            <Link
              href="/catalog"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 dark:bg-orange-500"
            >
              Весь каталог аниме
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-xs text-muted-foreground dark:text-zinc-500">
              Не нашёл свой жанр? Загляни в{" "}
              <Link
                href="/catalog"
                className="text-primary font-semibold underline-offset-4 hover:underline dark:text-orange-400"
              >
                каталог
              </Link>{" "}
              — там есть поиск и фильтры по году, типу и рейтингу.
            </p>
          </div>
        </div>
      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}