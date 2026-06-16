import { NextRequest, NextResponse } from 'next/server';

const MANGALIB_API_BASE = 'https://api.mangalib.me/api';

async function fetchFromMangalib<T>(endpoint: string, retries: number = 3): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `${MANGALIB_API_BASE}${endpoint}`;
      console.log(`[Mangalib Proxy] Fetching: ${url} (attempt ${attempt + 1}/${retries})`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://mangalib.me/',
          'Origin': 'https://mangalib.me',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Mangalib API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Mangalib Proxy] Success for ${endpoint}`);
      return data as T;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Mangalib Proxy] Attempt ${attempt + 1}/${retries} failed:`, error);
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Mangalib API: Max retries exceeded');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    console.log(`[Mangalib Proxy] Request for endpoint: ${endpoint}`);
    const data = await fetchFromMangalib<any>(endpoint);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Mangalib Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Mangalib API' },
      { status: 500 }
    );
  }
}
