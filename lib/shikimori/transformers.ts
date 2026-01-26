import { ShikimoriAnime, Anime, NewsItem } from "./types";
import { resolveBestPoster } from "./images";
import { SITE_URL } from "./config";
import { normalizeShikimoriUrl } from "./utils";
import { GenreFallbackService } from "../genre-fallback";

export async function transformAnime(item: ShikimoriAnime, enableGenreFallback: boolean = false): Promise<Anime> {
  const posterUrl = await resolveBestPoster(
    item.image?.original,
    item.name,
    item.russian,
    String(item.id)
  );

  // Get genres from Shikimori or use fallback
  let genres: string[] = [];
  
  if (item.genres && item.genres.length > 0) {
    genres = item.genres.map(g => g.russian).filter(Boolean);
  } else if (enableGenreFallback) {
    // Use synchronous fallback to avoid blocking the main request
    genres = GenreFallbackService.getFallbackGenresSync(
      item.russian || item.name, 
      item.name, 
      item.description
    );
    
    // Trigger async fetch in background for next time
    GenreFallbackService.getFallbackGenres(item.russian || item.name, item.name)
      .then(fallbackGenres => {
        if (fallbackGenres.length > 0 && fallbackGenres.length > genres.length) {
          console.log(`Better fallback genres found for "${item.russian || item.name}":`, fallbackGenres);
        }
      })
      .catch(error => {
        // Silently handle errors to avoid crashing the main request
        console.debug('Error fetching async fallback genres:', error);
      });
  }

  return {
    id: String(item.id),
    shikimoriId: String(item.id),
    title: item.russian || item.name,
    originalTitle: item.name,
    poster: posterUrl,
    rating: parseFloat(item.score) || 0,
    year: item.aired_on ? new Date(item.aired_on).getFullYear() : (new Date().getFullYear()),
    airedOn: item.aired_on || undefined,
    episodesCurrent: item.episodes_aired || 0,
    episodesTotal: item.episodes || 0,
    status: item.status === 'anons' ? 'Announcement' : item.status === 'ongoing' ? 'Ongoing' : 'Completed',
    description: item.description?.replace(/\[.*?\]/g, "") || "Описание отсутствует...",
    genres,
    quality: item.kind?.toUpperCase() || "TV",
  };
}

export function transformTopic(topic: any): NewsItem {
  const rawText = topic.body || "";
  const excerpt = rawText.length > 150 ? rawText.slice(0, 150) + "..." : rawText;

  let imageUrl: string | undefined;
  if (topic.html_body) {
    const match = topic.html_body.match(/<img[^>]+src="([^"]+)"/);
    if (match && match[1]) {
      imageUrl = match[1];
      if (imageUrl && !imageUrl.startsWith("http")) imageUrl = normalizeShikimoriUrl(imageUrl);
    }
  }

  return {
    id: String(topic.id),
    title: topic.topic_title,
    excerpt: excerpt,
    imageUrl: imageUrl || undefined,
    date: new Date(topic.created_at).toLocaleDateString('ru-RU'),
    author: topic.user.nickname,
    comments: topic.comments_count,
    url: `${SITE_URL}${topic.forum.url}/${topic.id}`,
  };
}