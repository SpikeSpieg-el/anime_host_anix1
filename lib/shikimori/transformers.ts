import { ShikimoriAnime, Anime, NewsItem, LinkedAnime } from "./types";
import { resolveBestPoster } from "./images";
import { SITE_URL } from "./config";
import { normalizeShikimoriUrl, upgradeShikimoriUrl } from "./utils";
import { GenreFallbackService } from "../genre-fallback";

/**
 * Lightweight transform for calendar - uses only Shikimori poster without external API calls
 * Client-side will fetch better posters in parallel
 */
export function transformAnimeCalendar(item: ShikimoriAnime): Anime {
  // Use only Shikimori poster URL without external fetching
  const posterUrl = upgradeShikimoriUrl(item.image?.original) || '';

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
    genres: item.genres?.map(g => g.russian).filter(Boolean) || [],
    quality: item.kind?.toUpperCase() || "TV",
  };
}

export async function transformAnime(item: ShikimoriAnime, enableGenreFallback: boolean = false, disableExternalAPIs: boolean = false): Promise<Anime> {
  const posterUrl = await resolveBestPoster(
    item.image?.original,
    item.name,
    item.russian,
    String(item.id),
    disableExternalAPIs
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

export function toLinkedAnimeFromShikimori(item: ShikimoriAnime): LinkedAnime {
  return {
    id: item.id,
    name: item.name || '',
    russian: item.russian || '',
    image: item.image || undefined,
    kind: item.kind || undefined,
    score: item.score || undefined,
    status: item.status || undefined,
    episodes: item.episodes || undefined,
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
  // Also check html_footer for images if no image found in body
  if (!imageUrl && topic.html_footer) {
    const match = topic.html_footer.match(/<img[^>]+src="([^"]+)"/);
    if (match && match[1]) {
      imageUrl = match[1];
      if (imageUrl && !imageUrl.startsWith("http")) imageUrl = normalizeShikimoriUrl(imageUrl);
    }
  }

  let linkedAnime: LinkedAnime | undefined;
  if (topic.linked && topic.linked_type === 'Anime' && topic.linked.id) {
    const linked = topic.linked;
    linkedAnime = {
      id: linked.id,
      name: linked.name || '',
      russian: linked.russian || '',
      image: linked.image || undefined,
      url: linked.url || undefined,
      kind: linked.kind || undefined,
      score: linked.score || undefined,
      status: linked.status || undefined,
      episodes: linked.episodes || undefined,
    };
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
    htmlBody: topic.html_body || undefined,
    htmlFooter: topic.html_footer || undefined,
    linkedAnime,
  };
}