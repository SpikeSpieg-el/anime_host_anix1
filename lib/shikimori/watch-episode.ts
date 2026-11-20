/** Refresh on a deep link only if the ordinary watch-page data is behind it. */
export async function refreshWatchAnimeForEpisode<T extends {
  episodesCurrent: number
  episodesTotal: number
}>(
  episode: number | undefined,
  load: () => Promise<T | null>,
  loadFresh: () => Promise<T | null>,
): Promise<T | null> {
  const cached = await load()
  if (!cached || !Number.isSafeInteger(episode) || !episode || episode < 1) return cached
  const known = cached.episodesCurrent || cached.episodesTotal || 0
  if (episode <= known) return cached

  try {
    const fresh = await loadFresh()
    const freshKnown = fresh && (fresh.episodesCurrent || fresh.episodesTotal || 0)
    return fresh && freshKnown && freshKnown > known ? fresh : cached
  } catch {
    return cached
  }
}
