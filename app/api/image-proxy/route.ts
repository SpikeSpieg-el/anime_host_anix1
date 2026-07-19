import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'konachan.net',
  'safebooru.org',
  'danbooru.donmai.us',
  'zerochan.net',
  's3.zerochan.net',
  'static.zerochan.net',
  'yande.re',
  'files.yande.re',
  'shikimori.one',
  'mixlib.me',
  'mangalib.me',
  'remanga.org',
  'reimg2.org',
  'img.reimg.org',
  'uploads.mangadex.org',
  'meo.comick.pictures',
  'cdn.mangaeden.com',
  'pinimg.com',
  'i.pinimg.com',
  'anilist.co',
  's4.anilist.co',
  'kitsu.app',
  'media.kitsu.app',
  'kodikapi.com',
  'kodik.info',
  'cdn.kodik.info',
  'cdn.myanimelist.net',
  'myanimelist.net',
  'imgur.com',
  'i.imgur.com',
  'discordapp.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'catbox.moe',
  'files.catbox.moe',
  'postimg.cc',
  'postimg.org',
  'github.com',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'picsum.photos',
  'transparenttextures.com'
];

export const maxDuration = 15;

const IMAGE_SERVER_URL = process.env.IMAGE_SERVER_URL || '';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  // Delegate to Coolify image service if configured (saves Vercel serverless time)
  if (IMAGE_SERVER_URL) {
    return NextResponse.redirect(`${IMAGE_SERVER_URL}/proxy?url=${encodeURIComponent(url)}`, { status: 302, headers: { 'Cache-Control': 'public, max-age=86400' } });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const isAllowed = ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  try {
    let referer = ''
    let origin: string | undefined = undefined;
    if (parsed.hostname.includes('konachan.net')) {
      referer = 'https://konachan.net/'
    } else if (parsed.hostname.includes('safebooru.org')) {
      referer = 'https://safebooru.org/'
    } else if (parsed.hostname.includes('zerochan.net') || parsed.hostname.includes('s3.zerochan.net')) {
      referer = 'https://www.zerochan.net/'
    } else if (parsed.hostname.includes('mixlib.me') || parsed.hostname.includes('mangalib.me')) {
      referer = 'https://mangalib.me/'
    } else if (parsed.hostname.includes('shikimori.one')) {
      referer = 'https://shikimori.one/'
    } else if (parsed.hostname.includes('remanga.org') || parsed.hostname.includes('reimg2.org') || parsed.hostname.includes('img.reimg.org')) {
      referer = 'https://remanga.org/'
      origin = 'https://remanga.org'
    } else if (parsed.hostname.includes('uploads.mangadex.org')) {
      referer = 'https://mangadex.org/'
    } else if (parsed.hostname.includes('yande.re') || parsed.hostname.includes('files.yande.re')) {
      referer = 'https://yande.re/'
    } else if (parsed.hostname.includes('pinimg.com')) {
      referer = 'https://www.pinterest.com/'
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };
    if (origin) {
      headers['Origin'] = origin;
    }

    if (parsed.hostname.includes('reimg2.org') || parsed.hostname.includes('img.reimg.org')) {
      if (parsed.hostname.includes('img.reimg.org')) {
        const remangaApiHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://remanga.org/',
          'Origin': 'https://remanga.org',
        };
        Object.keys(headers).forEach(key => delete headers[key]);
        Object.assign(headers, remangaApiHeaders);
      } else {
        headers['Sec-Fetch-Site'] = 'same-site';
        headers['Sec-Fetch-Mode'] = 'cors';
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    let res: Response;
    try {
      res = await fetch(url, { headers, signal: controller.signal });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('[image-proxy] Timeout fetching:', url);
        return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      console.error('[image-proxy] Upstream error:', res.status, res.statusText);
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    if (buffer.byteLength < 100) {
      console.error('[image-proxy] Response too small:', buffer.byteLength);
      return NextResponse.json({ error: 'Invalid image response' }, { status: 502 });
    }

    // Reject HTML or JSON error responses
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      console.error('[image-proxy] Non-image content-type:', contentType, buffer.byteLength);
      return NextResponse.json({ error: 'Non-image response' }, { status: 502 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[image-proxy] Fetch error:', err);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
