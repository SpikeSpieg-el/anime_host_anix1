import type { Anime, ShikimoriAnime } from "@/lib/shikimori/types"

export function makeShikimoriAnime(overrides: Partial<ShikimoriAnime> = {}): ShikimoriAnime {
  return {
    id: 16498,
    name: "Shingeki no Kyojin",
    russian: "Атака титанов",
    image: {
      original: "/system/animes/original/16498.jpg",
      preview: "/system/animes/preview/16498.jpg",
    },
    score: "8.5",
    episodes: 25,
    episodes_aired: 25,
    status: "released",
    aired_on: "2013-04-07",
    kind: "tv",
    rating: "r",
    description: "Люди живут за стенами. [b]Титаны[/b] нападают.",
    genres: [{ id: 1, name: "Action", russian: "Экшен" }],
    ...overrides,
  }
}

export function makeAnime(overrides: Partial<Anime> = {}): Anime {
  return {
    id: "16498",
    shikimoriId: "16498",
    title: "Атака титанов",
    originalTitle: "Shingeki no Kyojin",
    poster: "https://shikimori.one/system/animes/original/16498.jpg",
    rating: 8.5,
    year: 2013,
    airedOn: "2013-04-07",
    episodesCurrent: 25,
    episodesTotal: 25,
    status: "Completed",
    description: "Люди живут за стенами.",
    genres: ["Экшен"],
    quality: "TV",
    ...overrides,
  }
}
