import { WatchPageLayoutWrapper } from "@/components/watch/watch-page-layout-wrapper"
import type { EditorialReview } from "@/components/watch/watch-page-layout-wrapper"
import type { Anime, FranchiseItem } from "@/lib/shikimori"

interface WatchPageWithWatchOrderProps {
  anime: Anime
  initialEpisode?: number
  /**
   * Франшиза приходит промисом, а не массивом: страница не ждёт этот запрос
   * перед первым байтом HTML. К моменту отрисовки этот компонент уже внутри
   * <Suspense>, поэтому `await` разрешается стримом.
   */
  watchOrder: Promise<FranchiseItem[]>
  editorialReview?: EditorialReview | null
}

/**
 * Единственная задача — дождаться франшизы уже ПОСЛЕ начала стрима.
 *
 * Раньше `await getAnimeFranchise()` стоял в самом теле страницы, то есть
 * каждый заход на /watch платил за обход всей франшизы (на «Ван-Писе» — 30+
 * запросов к Shikimori) прежде чем отдать первый байт. Блок «порядок
 * просмотра» живёт под плеером, и ждать его на первом байте незачем.
 */
export async function WatchPageWithWatchOrder({
  anime,
  initialEpisode,
  watchOrder,
  editorialReview,
}: WatchPageWithWatchOrderProps) {
  const resolvedWatchOrder = await watchOrder

  return (
    <WatchPageLayoutWrapper
      anime={anime}
      initialEpisode={initialEpisode}
      watchOrder={resolvedWatchOrder}
      editorialReview={editorialReview}
    />
  )
}
