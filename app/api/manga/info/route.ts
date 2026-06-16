import { NextRequest, NextResponse } from 'next/server';
import { getMangaDexInfo, getMangaDexChapters } from '@/lib/mangadex/api';
import { searchRemangaSlug, getRemangaChaptersBySlug } from '@/lib/remanga/api';
import { searchMangalibSlug, getMangalibChaptersBySlug } from '@/lib/mangalib/api';

interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  lang?: string;
  provider?: 'mangadex' | 'remanga' | 'mangalib';
  fallbackId?: string; // Store MangaDex chapter ID as fallback for other providers
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    console.log('[MangaInfo] Request received for ID:', id);

    if (!id) {
      return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
    }

    // Validate UUID format (MangaDex uses UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.log('[MangaInfo] Invalid UUID format:', id);
      return NextResponse.json({ error: 'Invalid manga ID format. Expected UUID.' }, { status: 400 });
    }

    const [mangaInfo, chapters] = await Promise.all([
      getMangaDexInfo(id),
      getMangaDexChapters(id),
    ]);

    console.log('[MangaInfo] MangaDex info result:', mangaInfo ? 'Found' : 'Not found');
    console.log('[MangaInfo] Chapters count:', chapters.length);
    
    if (!mangaInfo) {
      return NextResponse.json({ error: 'Manga not found' }, { status: 404 });
    }

    let formattedChapters: Chapter[] = chapters.map((ch: { id: string; chapter: string; title?: string; translatedLanguage: string }) => ({
      id: ch.id,
      chapter: ch.chapter,
      title: ch.title,
      lang: ch.translatedLanguage,
      provider: 'mangadex' as const,
    }));

    // Always attempt to find Remanga and Mangalib chapters to merge Russian translations
    // Especially important when MangaDex has no chapters (common for Russian manga)
    if (mangaInfo.title) {
      console.log(`[HybridReader] Attempting to find Remanga chapters for "${mangaInfo.title}"...`);
      const remangaSlug = await searchRemangaSlug(mangaInfo.title, mangaInfo.altTitles || []);

      if (remangaSlug) {
        console.log(`[HybridReader] Found Remanga slug "${remangaSlug}" for "${mangaInfo.title}". Fetching chapters...`);
        const remangaChapters = await getRemangaChaptersBySlug(remangaSlug);
        console.log(`[HybridReader] Remanga returned ${remangaChapters.length} chapters`);
        
        const remangaFormatted: Chapter[] = remangaChapters.map(ch => ({
          id: ch.id,
          chapter: ch.chapter,
          title: ch.title,
          lang: ch.lang,
          provider: 'remanga' as const,
        }));

        // Merge chapters: group by chapter_number and lang
        // If we have both, prioritize Remanga for 'ru' language as it has more chapters / better quality
        const chapterMap = new Map<string, Chapter>();
        
        // Add MangaDex chapters first
        formattedChapters.forEach(ch => {
          const key = `${ch.chapter}_${ch.lang}`;
          chapterMap.set(key, ch);
        });

        // Add Remanga chapters (which overrides RU chapters if they already exist from MangaDex)
        // Store the MangaDex chapter ID as fallback for Remanga chapters
        remangaFormatted.forEach(ch => {
          const key = `${ch.chapter}_${ch.lang}`;
          const existingMangaDex = chapterMap.get(key);
          if (existingMangaDex && existingMangaDex.provider === 'mangadex') {
            ch.fallbackId = existingMangaDex.id; // Store MangaDex ID as fallback
          }
          chapterMap.set(key, ch);
        });

        formattedChapters = Array.from(chapterMap.values());
        console.log(`[HybridReader] Total chapters after Remanga merge: ${formattedChapters.length}`);
      } else {
        console.log(`[HybridReader] No Remanga slug found for "${mangaInfo.title}"`);
      }

      // Try Mangalib as additional Russian source
      console.log(`[HybridReader] Attempting to find Mangalib chapters for "${mangaInfo.title}"...`);
      const mangalibSlug = await searchMangalibSlug(mangaInfo.title, mangaInfo.altTitles || []);

      if (mangalibSlug) {
        console.log(`[HybridReader] Found Mangalib slug "${mangalibSlug}" for "${mangaInfo.title}". Fetching chapters...`);
        const mangalibChapters = await getMangalibChaptersBySlug(mangalibSlug);
        console.log(`[HybridReader] Mangalib returned ${mangalibChapters.length} chapters`);
        
        const mangalibFormatted: Chapter[] = mangalibChapters.map(ch => ({
          id: ch.id,
          chapter: ch.chapter,
          title: ch.title,
          lang: ch.lang,
          provider: 'mangalib' as const,
        }));

        // Merge with existing chapters
        const chapterMap = new Map<string, Chapter>();
        
        // Add existing chapters first
        formattedChapters.forEach(ch => {
          const key = `${ch.chapter}_${ch.lang}`;
          chapterMap.set(key, ch);
        });

        // Add Mangalib chapters
        mangalibFormatted.forEach(ch => {
          const key = `${ch.chapter}_${ch.lang}`;
          const existingMangaDex = chapterMap.get(key);
          if (existingMangaDex && existingMangaDex.provider === 'mangadex') {
            ch.fallbackId = existingMangaDex.id; // Store MangaDex ID as fallback
          }
          chapterMap.set(key, ch);
        });

        formattedChapters = Array.from(chapterMap.values());
        console.log(`[HybridReader] Total chapters after Mangalib merge: ${formattedChapters.length}`);
      } else {
        console.log(`[HybridReader] No Mangalib slug found for "${mangaInfo.title}"`);
      }
    }

    // Sort chapters in ascending order numerically (chapter 1 first)
    formattedChapters.sort((a, b) => {
      const numA = parseFloat(a.chapter);
      const numB = parseFloat(b.chapter);
      
      const isNumANaN = isNaN(numA);
      const isNumBNaN = isNaN(numB);

      if (isNumANaN || isNumBNaN) {
        if (a.chapter !== b.chapter) {
          return a.chapter.localeCompare(b.chapter);
        }
      } else if (numA !== numB) {
        return numA - numB;
      }

      // Same chapter, sort Russian ('ru') first
      if (a.lang === 'ru' && b.lang !== 'ru') return -1;
      if (b.lang === 'ru' && a.lang !== 'ru') return 1;
      return 0;
    });

    return NextResponse.json({
      ...mangaInfo,
      chapters: formattedChapters,
    });
  } catch (error) {
    console.error('Error getting manga info:', error);
    return NextResponse.json({ error: 'Failed to get manga info' }, { status: 500 });
  }
}
