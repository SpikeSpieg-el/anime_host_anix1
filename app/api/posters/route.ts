import { NextRequest, NextResponse } from "next/server";
import { resolveBestPoster } from "@/lib/shikimori/images";

interface PosterRequest {
  id: string;
  romajiName: string;
  russianName: string;
  shikimoriUrl?: string;
}

interface PosterResponse {
  id: string;
  poster: string;
}

async function getShikimoriAnimeData(id: string): Promise<{ posterUrl: string; romajiName: string }> {
  try {
    const response = await fetch(`https://shikimori.one/api/animes/${encodeURIComponent(id)}`, {
      headers: { "User-Agent": "Weebx/1.0" },
      next: { revalidate: 86400 },
    });

    if (!response.ok) return { posterUrl: "", romajiName: "" };

    const anime = await response.json();
    const rawPoster = anime.image?.original || anime.image?.large || anime.image?.x96 || "";
    const isPlaceholder = ['missing', 'stub', 'placeholder', 'default'].some(s => rawPoster.toLowerCase().includes(s));
    return {
      posterUrl: isPlaceholder ? "" : rawPoster,
      romajiName: anime.name || "",
    };
  } catch (error) {
    console.warn(`[Posters API] Failed to resolve Shikimori data for ${id}:`, error);
    return { posterUrl: "", romajiName: "" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { animes } = await req.json() as { animes: PosterRequest[] };

    if (!Array.isArray(animes) || animes.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid animes array" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    const batch = animes.slice(0, 100);
    console.log(`[Posters API] Starting batch fetch for ${batch.length} anime`);
    const startTime = Date.now();

    // Track source stats
    let shikimoriCount = 0;
    let externalCount = 0;
    let fallbackCount = 0;

    // Fetch all posters in parallel with a concurrency limit
    const concurrencyLimit = 5;
    const results: PosterResponse[] = [];
    
    for (let i = 0; i < batch.length; i += concurrencyLimit) {
      const chunk = batch.slice(i, i + concurrencyLimit);
      const chunkPromises = chunk.map(async (anime) => {
        try {
          let shikimoriUrl = anime.shikimoriUrl || "";
          let romajiName = anime.romajiName || "";

          // If no shikimoriUrl provided, fetch from Shikimori API by ID
          if (!shikimoriUrl) {
            const shikiData = await getShikimoriAnimeData(anime.id);
            shikimoriUrl = shikiData.posterUrl;
            // Use the romaji name from Shikimori API for accurate external API searches
            if (shikiData.romajiName) romajiName = shikiData.romajiName;
          }

          const poster = await resolveBestPoster(
            shikimoriUrl,
            romajiName,
            anime.russianName,
            anime.id,
            false // allow external APIs
          );
          
          // Track source
          if (poster.includes('shikimori')) {
            shikimoriCount++;
          } else if (poster.includes('kodik') || poster.includes('anilist') || poster.includes('myanimelist')) {
            externalCount++;
          } else {
            fallbackCount++;
          }
          
          return { id: anime.id, poster };
        } catch (error) {
          console.error(`[Posters API] Error fetching poster for ${anime.id}:`, error);
          fallbackCount++;
          // Return a fallback poster
          return { 
            id: anime.id, 
            poster: generateFallbackPoster(anime.russianName || anime.romajiName)
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const duration = Date.now() - startTime;
    console.log(`[Posters API] Completed: ${results.length} posters in ${duration}ms (Shikimori: ${shikimoriCount}, External: ${externalCount}, Fallback: ${fallbackCount})`);

    return NextResponse.json({ posters: results });
  } catch (error) {
    console.error("[Posters API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posters" },
      { status: 500 }
    );
  }
}

function generateFallbackPoster(title: string): string {
  // Return a proper URL instead of data URL for better SEO
  return `/api/fallback-poster?title=${encodeURIComponent(title)}`;
}
