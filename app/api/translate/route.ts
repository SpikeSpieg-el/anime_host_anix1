import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

export async function POST(req: NextRequest) {
  try {
    const { text, source = 'en', target = 'ru' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Limit text length to avoid abuse
    if (text.length > 15000) {
      return NextResponse.json({ error: 'Text too long' }, { status: 413 });
    }

    const url = new URL(GOOGLE_TRANSLATE_URL);
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', source);
    url.searchParams.set('tl', target);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Translate API error: ${response.status}`);
    }

    const data = await response.json();

    // Google returns [[["translated","original",...],...], ...]
    // Reconstruct the full translated text from segments
    const segments: string[] = [];
    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (const segment of data[0]) {
        if (Array.isArray(segment) && typeof segment[0] === 'string') {
          segments.push(segment[0]);
        }
      }
    }

    const translated = segments.join('');

    return NextResponse.json({ translated, source, target });
  } catch (e) {
    console.error('[translate] Error:', e);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
