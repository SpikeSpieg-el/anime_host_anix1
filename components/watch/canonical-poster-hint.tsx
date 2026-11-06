/**
 * preload обложки тайтла для /watch.
 *
 * В плеере LCP-элемент — постер/заставка, и он появляется только после
 * гидратации клиентского плеера. Без подсказки браузер узнаёт об адресе
 * картинки поздно и стартует её загрузку уже после первого рендера.
 *
 * Ставим `fetchpriority="high"`: preload с низким приоритетом браузер
 * откладывает, и смысл тега теряется. Относительные и data:-адреса не
 * подсказываем — preload для них бесполезен или вреден.
 */
export function CanonicalPosterHint({ poster }: { poster?: string | null }) {
  if (!poster || poster.startsWith("data:")) return null

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
