import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'i.pinimg.com',
  'pinterest.com',
  'konachan.net',
  'safebooru.org',
  'zerochan.net',
  's3.zerochan.net',
  'shikimori.one'
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
    if (parsed.hostname.includes('konachan.net')) {
      referer = 'https://konachan.net/'
    } else if (parsed.hostname.includes('safebooru.org')) {
      referer = 'https://safebooru.org/'
    } else if (parsed.hostname.includes('zerochan.net') || parsed.hostname.includes('s3.zerochan.net')) {
      referer = 'https://www.zerochan.net/'
    } else if (parsed.hostname.includes('shikimori.one')) {
      referer = 'https://shikimori.one/'
    }

    const res = await fetch(url, {
      headers: {
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
      },
    });

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
    if (contentType.includes('image/')) {
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
      // Increased threshold from 30 to 50 to catch more gradients
      // Also check for small images which are more likely to be placeholders
      if (avgVariance < 50 || (buffer.byteLength < 50000 && avgVariance < 80)) {
        console.error('[image-proxy] Low color variance detected (likely gradient):', avgVariance, 'size:', buffer.byteLength);
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
