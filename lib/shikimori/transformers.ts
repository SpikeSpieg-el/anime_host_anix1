import { ShikimoriAnime, Anime, NewsItem } from "./types";
import { resolveBestPoster } from "./images";
import { SITE_URL } from "./config";
import { normalizeShikimoriUrl } from "./utils";

export async function transformAnime(item: ShikimoriAnime): Promise<Anime> {
  const posterUrl = await resolveBestPoster(
    item.image?.original,
    item.name,
    item.russian,
    String(item.id)
  );

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
    genres: item.genres?.map(g => g.russian) || [],
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