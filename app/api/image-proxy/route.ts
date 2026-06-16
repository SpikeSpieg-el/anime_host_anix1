import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'i.pinimg.com',
  'pinterest.com',
  'konachan.net',
  'safebooru.org',
  'zerochan.net',
  's3.zerochan.net',
  'shikimori.one',
  'mixlib.me',
  'mangalib.me',
  'remanga.org',
  'reimg2.org',
  'img.reimg.org'
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
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
    // Set appropriate headers based on the domain
    let referer = 'https://www.pinterest.com/'
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

    // Try additional headers for reimg2.org and img.reimg.org to bypass hotlink protection
    if (parsed.hostname.includes('reimg2.org') || parsed.hostname.includes('img.reimg.org')) {
      // For img.reimg.org, use the exact same headers that work for the Remanga API
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

    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error('[image-proxy] Upstream error:', res.status, res.statusText);
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    // Check if response is valid image (minimum size check)
    if (buffer.byteLength < 100) {
      console.error('[image-proxy] Response too small:', buffer.byteLength);
      return NextResponse.json({ error: 'Invalid image response' }, { status: 502 });
    }

    // Check for common Pinterest placeholder patterns in the buffer
    const uint8Array = new Uint8Array(buffer);
    const isLikelyPlaceholder = 
      buffer.byteLength < 1000 || // Very small images are often placeholders
      contentType.includes('application/json'); // Sometimes returns JSON error

    // Allow HTML responses for some domains that might return HTML with embedded images
    // but reject if it's too small to be useful
    if (contentType.includes('text/html') && buffer.byteLength < 10000) {
      console.error('[image-proxy] HTML response too small:', contentType, buffer.byteLength);
      return NextResponse.json({ error: 'HTML response too small' }, { status: 502 });
    }

    if (isLikelyPlaceholder) {
      console.error('[image-proxy] Likely placeholder returned:', contentType, buffer.byteLength);
      return NextResponse.json({ error: 'Placeholder image detected' }, { status: 502 });
    }

    // Additional check: detect gradient placeholders by analyzing color variance
    // Gradient placeholders typically have very low color variance
    if (contentType.includes('image/') && !parsed.hostname.includes('remanga.org') && !parsed.hostname.includes('reimg2.org') && !parsed.hostname.includes('mixlib.me') && !parsed.hostname.includes('mangalib.me')) {
      let colorVariance = 0;
      const sampleSize = Math.min(1000, buffer.byteLength);
      for (let i = 0; i < sampleSize - 3; i += 4) {
        const r = uint8Array[i];
        const g = uint8Array[i + 1];
        const b = uint8Array[i + 2];
        const avg = (r + g + b) / 3;
        colorVariance += Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
      }
      const avgVariance = colorVariance / (sampleSize / 4);
      
      // Very low variance suggests a gradient or solid color placeholder
      // Scale threshold based on image size - larger images are less likely to be placeholders
      let varianceThreshold = 50;
      if (buffer.byteLength > 50000) {
        varianceThreshold = 30; // More lenient for larger images
      } else if (buffer.byteLength < 20000) {
        varianceThreshold = 80; // Stricter for small images
      }
      
      if (avgVariance < varianceThreshold) {
        console.error('[image-proxy] Low color variance detected (likely gradient):', avgVariance, 'size:', buffer.byteLength, 'threshold:', varianceThreshold);
        return NextResponse.json({ error: 'Gradient placeholder detected' }, { status: 502 });
      }
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
