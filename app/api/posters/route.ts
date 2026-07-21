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
      headers: { "User-Agent": "AnixStream/1.0" },
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
  const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const index = Math.abs(hash) % 4;
  const letter = title.slice(0, 1).toUpperCase();
  
  const styles = [
    { bg: '#1a0505', textColor: '#fed7aa', accentColor: '#ea580c' },
    { bg: '#020617', textColor: '#bfdbfe', accentColor: '#3b82f6' },
    { bg: '#1e1b4b', textColor: '#e9d5ff', accentColor: '#8b5cf6' },
    { bg: '#18181b', textColor: '#e4e4e7', accentColor: '#22c55e' }
  ];
  
  const style = styles[index];
  const svg = `
    <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${style.bg}"/>
      <text x="50%" y="40%" font-family="sans-serif" font-weight="900" font-size="300" fill="${style.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text>
      <text x="50%" y="55%" font-family="sans-serif" font-size="24" fill="${style.textColor}" text-anchor="middle" font-weight="bold">${title}</text>
      <text x="50%" y="580" font-family="sans-serif" font-size="12" fill="${style.textColor}" opacity="0.6" text-anchor="middle">ANIME COLLECTION</text>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
