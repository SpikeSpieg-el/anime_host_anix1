import { NextRequest, NextResponse } from 'next/server';

const MANGAEDEN_API_BASE = 'https://www.mangaeden.com/api';

async function fetchFromMangaEden<T>(endpoint: string): Promise<T> {
  const url = `${MANGAEDEN_API_BASE}${endpoint}`;
  console.log(`[MangaEden Proxy] Fetching: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`MangaEden API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[MangaEden Proxy] Success for ${endpoint}`);
    return data as T;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[MangaEden Proxy] Fetch error for ${url}:`, error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    console.log(`[MangaEden Proxy] Request for endpoint: ${endpoint}`);
    const data = await fetchFromMangaEden<any>(endpoint);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[MangaEden Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from MangaEden API' },
      { status: 500 }
    );
  }
}
