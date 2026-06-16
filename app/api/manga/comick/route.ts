import { NextRequest, NextResponse } from 'next/server';

const COMICK_API_BASE = 'https://comick.io/api';

async function fetchFromComick<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${COMICK_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log(`[Comick Proxy] Fetching: ${url.toString()}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MangaReader/1.0',
        'Accept': 'application/json',
        'Referer': 'https://comick.io/',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Comick Proxy] API error ${response.status}: ${text.substring(0, 200)}`);
      throw new Error(`Comick API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Comick Proxy] Success for ${endpoint}`);
    return data as T;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[Comick Proxy] Fetch error for ${url.toString()}:`, error);
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

    // Extract additional query params
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        params[key] = value;
      }
    });

    console.log(`[Comick Proxy] Request for endpoint: ${endpoint}`);
    const data = await fetchFromComick<any>(endpoint, params);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Comick Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Comick API' },
      { status: 500 }
    );
  }
}
