import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
  }

  try {
    // Validate URL to prevent SSRF attacks
    const url = new URL(imageUrl);
    const allowedDomains = [
      'shikimori.one',
      'anilist.co',
      's4.anilist.co',
      'kitsu.app',
      'media.kitsu.app',
      'kodikapi.com',
      'kodik.info',
      'cdn.kodik.info',
      'cdn.myanimelist.net',
      'myanimelist.net',
      'i.pinimg.com',
      'pinimg.com',
    ];

    if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // Fetch the image with proper headers
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      // Cache for 24 hours
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    // Get image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper caching headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Thumbnail Proxy] Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
