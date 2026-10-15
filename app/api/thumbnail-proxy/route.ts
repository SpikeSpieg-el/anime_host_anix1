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
      'kitsu-production-media.s3.us-west-002.backblazeb2.com',
      'kodikapi.com',
      'kodik.info',
      'cdn.kodik.info',
      'cdn.myanimelist.net',
      'myanimelist.net',
      'i.pinimg.com',
      'pinimg.com',
    ];

    if (!allowedDomains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // Fetch the image with proper headers
    //
    // Таймаут обязателен. Раньше запрос к shikimori/anilist висел без
    // ограничения: Googlebot обходит страницы пачками, и каждый "висящий"
    // запрос занимал слот соединения. При всплеске это давало в отчёте
    // "не удалось просканировать уменьшенное изображение, так как хост
    // перегружен" — то есть ровно тот симптом, который мы чинили.
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(8000),
      // Cache for 24 hours
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    // Get image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Пустой или подозрительно маленький ответ почти всегда означает не
    // картинку (заглушка, редирект, HTML-ошибка). Отдавать такое Googlebot
    // хуже явной ошибки: он зафиксирует битое изображение и не вернётся.
    const MIN_IMAGE_BYTES = 512;
    if (imageBuffer.byteLength < MIN_IMAGE_BYTES) {
      return NextResponse.json({ error: "Empty image" }, { status: 502 });
    }

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
