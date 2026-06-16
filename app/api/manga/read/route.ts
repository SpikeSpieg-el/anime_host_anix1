import { NextRequest, NextResponse } from 'next/server';
import { getMangaDexChapterPages } from '@/lib/mangadex/api';
import { getRemangaChapterPages } from '@/lib/remanga/api';
import { getMangalibChapterPages } from '@/lib/mangalib/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chapterId = searchParams.get('chapterId');
    const provider = searchParams.get('provider') || 'mangadex';
    const fallbackId = searchParams.get('fallbackId');

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId parameter is required' }, { status: 400 });
    }

    let pages: string[] = [];
    if (provider === 'remanga') {
      const rawPages = await getRemangaChapterPages(chapterId);
      console.log('[MangaRead] Remanga returned', rawPages.length, 'pages');
      
      // If Remanga returns no pages (due to img.reimg.org filtering), fall back to MangaDex
      if (rawPages.length === 0) {
        if (fallbackId) {
          console.log('[MangaRead] Remanga has no pages, falling back to MangaDex chapter:', fallbackId);
          pages = await getMangaDexChapterPages(fallbackId);
        } else {
          console.warn('[MangaRead] Remanga has no pages and no MangaDex fallback available');
        }
      } else {
        pages = rawPages.map(url => `/api/image-proxy?url=${encodeURIComponent(url)}`);
      }
    } else if (provider === 'mangalib') {
      const rawPages = await getMangalibChapterPages(chapterId);
      console.log('[MangaRead] Mangalib returned', rawPages.length, 'pages');
      
      // If Mangalib returns no pages, fall back to MangaDex
      if (rawPages.length === 0) {
        if (fallbackId) {
          console.log('[MangaRead] Mangalib has no pages, falling back to MangaDex chapter:', fallbackId);
          pages = await getMangaDexChapterPages(fallbackId);
        } else {
          console.warn('[MangaRead] Mangalib has no pages and no MangaDex fallback available');
        }
      } else {
        pages = rawPages.map(url => `/api/image-proxy?url=${encodeURIComponent(url)}`);
      }
    } else {
      pages = await getMangaDexChapterPages(chapterId);
    }

    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Error getting manga chapter pages:', error);
    return NextResponse.json({ error: 'Failed to get manga chapter pages' }, { status: 500 });
  }
}
