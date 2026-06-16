import { NextRequest, NextResponse } from 'next/server';
import { getMangaDexChapterPages } from '@/lib/mangadex/api';
import { getRemangaChapterPages } from '@/lib/remanga/api';
import { getMangalibChapterPages } from '@/lib/mangalib/api';
import { getComickChapterPages } from '@/lib/comick/api';
import { getMangaEdenChapterPages } from '@/lib/mangaeden/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chapterId = searchParams.get('chapterId');
    const provider = searchParams.get('provider') || 'mangadex';
    const fallbackId = searchParams.get('fallbackId');
    const mangalibId = searchParams.get('mangalibId');
    const comickId = searchParams.get('comickId');
    const mangaedenId = searchParams.get('mangaedenId');
    const mangaId = searchParams.get('mangaId');

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId parameter is required' }, { status: 400 });
    }

    let pages: string[] = [];
    let usedProvider = provider;

    if (provider === 'remanga') {
      const rawPages = await getRemangaChapterPages(chapterId);
      console.log('[MangaRead] Remanga returned', rawPages.length, 'pages');
      
      // If Remanga returns no pages, try fallbacks in order: Mangalib -> Comick -> MangaEden -> MangaDex
      if (rawPages.length === 0) {
        if (mangalibId) {
          console.log('[MangaRead] Remanga has no pages, falling back to Mangalib chapter:', mangalibId);
          const mangalibPages = await getMangalibChapterPages(mangalibId);
          if (mangalibPages.length > 0) {
            pages = mangalibPages.map(url => `/api/image-proxy?url=${encodeURIComponent(url)}`);
            usedProvider = 'mangalib';
          } else if (comickId) {
            console.log('[MangaRead] Mangalib also has no pages, falling back to Comick chapter:', comickId);
            const comickPages = await getComickChapterPages(comickId);
            if (comickPages.length > 0) {
              pages = comickPages;
              usedProvider = 'comick';
            } else if (mangaedenId) {
              console.log('[MangaRead] Comick also has no pages, falling back to MangaEden chapter:', mangaedenId);
              const mangaedenPages = await getMangaEdenChapterPages(mangaedenId);
              if (mangaedenPages.length > 0) {
                pages = mangaedenPages;
                usedProvider = 'mangaeden';
              } else if (fallbackId) {
                console.log('[MangaRead] MangaEden also has no pages, falling back to MangaDex chapter:', fallbackId);
                pages = await getMangaDexChapterPages(fallbackId);
                usedProvider = 'mangadex';
              }
            } else if (fallbackId) {
              console.log('[MangaRead] Comick has no pages, falling back to MangaDex chapter:', fallbackId);
              pages = await getMangaDexChapterPages(fallbackId);
              usedProvider = 'mangadex';
            }
          } else if (fallbackId) {
            console.log('[MangaRead] Mangalib has no pages, falling back to MangaDex chapter:', fallbackId);
            pages = await getMangaDexChapterPages(fallbackId);
            usedProvider = 'mangadex';
          }
        } else if (comickId) {
          console.log('[MangaRead] Remanga has no pages, falling back to Comick chapter:', comickId);
          const comickPages = await getComickChapterPages(comickId);
          if (comickPages.length > 0) {
            pages = comickPages;
            usedProvider = 'comick';
          } else if (fallbackId) {
            console.log('[MangaRead] Comick has no pages, falling back to MangaDex chapter:', fallbackId);
            pages = await getMangaDexChapterPages(fallbackId);
            usedProvider = 'mangadex';
          }
        } else if (fallbackId) {
          console.log('[MangaRead] Remanga has no pages, falling back to MangaDex chapter:', fallbackId);
          pages = await getMangaDexChapterPages(fallbackId);
          usedProvider = 'mangadex';
        } else {
          console.warn('[MangaRead] Remanga has no pages and no fallbacks available');
        }
      } else {
        pages = rawPages.map(url => `/api/image-proxy?url=${encodeURIComponent(url)}`);
      }
    } else if (provider === 'mangalib') {
      const rawPages = await getMangalibChapterPages(chapterId);
      console.log('[MangaRead] Mangalib returned', rawPages.length, 'pages');
      
      // If Mangalib returns no pages, fall back to Comick -> MangaEden -> MangaDex
      if (rawPages.length === 0) {
        if (comickId) {
          console.log('[MangaRead] Mangalib has no pages, falling back to Comick chapter:', comickId);
          const comickPages = await getComickChapterPages(comickId);
          if (comickPages.length > 0) {
            pages = comickPages;
            usedProvider = 'comick';
          } else if (mangaedenId) {
            console.log('[MangaRead] Comick also has no pages, falling back to MangaEden chapter:', mangaedenId);
            const mangaedenPages = await getMangaEdenChapterPages(mangaedenId);
            if (mangaedenPages.length > 0) {
              pages = mangaedenPages;
              usedProvider = 'mangaeden';
            } else if (fallbackId) {
              console.log('[MangaRead] MangaEden also has no pages, falling back to MangaDex chapter:', fallbackId);
              pages = await getMangaDexChapterPages(fallbackId);
              usedProvider = 'mangadex';
            }
          } else if (fallbackId) {
            console.log('[MangaRead] Comick has no pages, falling back to MangaDex chapter:', fallbackId);
            pages = await getMangaDexChapterPages(fallbackId);
            usedProvider = 'mangadex';
          }
        } else if (mangaedenId) {
          console.log('[MangaRead] Mangalib has no pages, falling back to MangaEden chapter:', mangaedenId);
          const mangaedenPages = await getMangaEdenChapterPages(mangaedenId);
          if (mangaedenPages.length > 0) {
            pages = mangaedenPages;
            usedProvider = 'mangaeden';
          } else if (fallbackId) {
            console.log('[MangaRead] MangaEden has no pages, falling back to MangaDex chapter:', fallbackId);
            pages = await getMangaDexChapterPages(fallbackId);
            usedProvider = 'mangadex';
          }
        } else if (fallbackId) {
          console.log('[MangaRead] Mangalib has no pages, falling back to MangaDex chapter:', fallbackId);
          pages = await getMangaDexChapterPages(fallbackId);
          usedProvider = 'mangadex';
        } else {
          console.warn('[MangaRead] Mangalib has no pages and no MangaDex fallback available');
        }
      } else {
        pages = rawPages.map(url => `/api/image-proxy?url=${encodeURIComponent(url)}`);
      }
    } else if (provider === 'comick') {
      const rawPages = await getComickChapterPages(chapterId);
      console.log('[MangaRead] Comick returned', rawPages.length, 'pages');
      
      // If Comick returns no pages, fall back to MangaEden -> MangaDex
      if (rawPages.length === 0) {
        if (mangaedenId) {
          console.log('[MangaRead] Comick has no pages, falling back to MangaEden chapter:', mangaedenId);
          const mangaedenPages = await getMangaEdenChapterPages(mangaedenId);
          if (mangaedenPages.length > 0) {
            pages = mangaedenPages;
            usedProvider = 'mangaeden';
          } else if (fallbackId) {
            console.log('[MangaRead] MangaEden has no pages, falling back to MangaDex chapter:', fallbackId);
            pages = await getMangaDexChapterPages(fallbackId);
            usedProvider = 'mangadex';
          }
        } else if (fallbackId) {
          console.log('[MangaRead] Comick has no pages, falling back to MangaDex chapter:', fallbackId);
          pages = await getMangaDexChapterPages(fallbackId);
          usedProvider = 'mangadex';
        } else {
          console.warn('[MangaRead] Comick has no pages and no fallbacks available');
        }
      } else {
        pages = rawPages;
      }
    } else if (provider === 'mangaeden') {
      const rawPages = await getMangaEdenChapterPages(chapterId);
      console.log('[MangaRead] MangaEden returned', rawPages.length, 'pages');
      
      // If MangaEden returns no pages, fall back to MangaDex
      if (rawPages.length === 0) {
        if (fallbackId) {
          console.log('[MangaRead] MangaEden has no pages, falling back to MangaDex chapter:', fallbackId);
          pages = await getMangaDexChapterPages(fallbackId);
          usedProvider = 'mangadex';
        } else {
          console.warn('[MangaRead] MangaEden has no pages and no MangaDex fallback available');
        }
      } else {
        pages = rawPages;
      }
    } else {
      pages = await getMangaDexChapterPages(chapterId);
    }

    // If still no pages after fallback, return empty array with warning
    if (pages.length === 0) {
      console.warn('[MangaRead] No pages available from any provider');
    }

    return NextResponse.json({ pages, usedProvider });
  } catch (error) {
    console.error('Error getting manga chapter pages:', error);
    return NextResponse.json({ error: 'Failed to get manga chapter pages' }, { status: 500 });
  }
}
