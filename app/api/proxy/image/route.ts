import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate the URL to prevent abuse
    const url = new URL(imageUrl);
    const allowedDomains = [
      'myanimelist.net',
      'cdn.myanimelist.net',
      'remanga.org',
      'reimg.org',
      'img.reimg.org',
      'img3.reimg2.org',
      'img2.reimg2.org',
      'mangalib.me',
      'cdn.mangalib.me'
    ];
    
    if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
      return NextResponse.json({ error: 'Invalid URL domain' }, { status: 400 });
    }

    // Determine the appropriate referer based on the domain
    let referer = 'https://myanimelist.net/';
    if (url.hostname.includes('remanga.org') || url.hostname.includes('reimg.org')) {
      referer = 'https://remanga.org/';
    } else if (url.hostname.includes('mangalib.me')) {
      referer = 'https://mangalib.me/';
    }

    // Fetch the image directly (server-side fetch doesn't have CORS restrictions)
    // Add retry logic for transient network failures
    let response: Response | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': referer,
          },
          signal: AbortSignal.timeout(15000),
        });
        break;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ImageProxy] Fetch attempt ${attempt + 1}/3 failed for ${imageUrl}:`, error);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    if (!response || !response.ok) {
      console.error('Image fetch failed:', response?.status, response?.statusText);
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response?.status || 500 });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
  }
}
