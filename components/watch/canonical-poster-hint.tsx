import { isPlaceholderPoster } from "@/lib/poster-url"

/**
 * preload обложки тайтла для /watch.
 *
 * В плеере LCP-элемент — постер/заставка, и он появляется только после
 * гидратации клиентского плеера. Без подсказки браузер узнаёт об адресе
 * картинки поздно и стартует её загрузку уже после первого рендера.
 *
 * Ставим `fetchpriority="high"`: preload с низким приоритетом браузер
 * откладывает, и смысл тега теряется. Заглушки (data:, /api/fallback-poster,
 * missing_original.jpg) не подсказываем — preload для них бесполезен или вреден.
 */

export function CanonicalPosterHint({ poster }: { poster?: string | null }) {
  // data:-заглушки и /api/fallback-poster предзагружать бессмысленно: браузер
  // всё равно покажет их мгновенно, а bandwidth/приоритет LCP только тратим.
  if (!poster || isPlaceholderPoster(poster)) return null

  return (
    <link
      rel="preload"
      as="image"
      href={poster}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore -- fetchPriority поддерживается React 19 на <link>
      fetchPriority="high"
    />
  )
}
