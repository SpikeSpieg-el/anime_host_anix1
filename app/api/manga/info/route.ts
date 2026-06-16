import { NextRequest, NextResponse } from 'next/server';
import { getMangaDexInfo, getMangaDexChapters } from '@/lib/mangadex/api';
import { searchRemangaSlug, getRemangaChaptersBySlug } from '@/lib/remanga/api';
import { searchMangalibSlug, getMangalibChaptersBySlug } from '@/lib/mangalib/api';
import { searchShikimoriMangaLinks } from '@/lib/shikimori/manga';
import { searchComick, getComickChapters, getComickInfo } from '@/lib/comick/api';
import { searchMangaEden, getMangaEdenInfo, getMangaEdenChapterPages } from '@/lib/mangaeden/api';

interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  lang?: string;
  provider?: 'mangadex' | 'remanga' | 'mangalib' | 'comick' | 'mangaeden';
  fallbackId?: string; // Store MangaDex chapter ID as fallback for other providers
  mangalibId?: string; // Store Mangalib chapter ID as additional fallback
  comickId?: string; // Store Comick chapter ID as additional fallback
  mangaedenId?: string; // Store MangaEden chapter ID as additional fallback
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

    let mangaInfo = null;
    let chapters: any[] = [];
    
    // Try MangaDex first
    try {
      mangaInfo = await getMangaDexInfo(id);
      chapters = await getMangaDexChapters(id);
      console.log('[MangaInfo] MangaDex info result:', mangaInfo ? 'Found' : 'Not found');
      console.log('[MangaInfo] MangaDex chapters count:', chapters.length);
    } catch (error) {
      console.error('[MangaInfo] Error fetching from MangaDex:', error);
    }

    // If MangaDex doesn't have the manga, try other APIs by searching with the title
    if (!mangaInfo) {
      console.log('[MangaInfo] MangaDex not found, trying other APIs...');
      
      // Try Comick search
      try {
        const comickResults = await searchComick(id, 5);
        if (comickResults.length > 0) {
          const comickInfo = await getComickInfo(comickResults[0].id);
          if (comickInfo) {
            mangaInfo = comickInfo;
            const comickChapters = await getComickChapters(comickResults[0].id);
            chapters = comickChapters.map((ch: any) => ({
              ...ch,
              provider: 'comick',
            }));
            console.log('[MangaInfo] Found manga on Comick, chapters:', chapters.length);
          }
        }
      } catch (error) {
        console.error('[MangaInfo] Error fetching from Comick:', error);
      }

      // Try MangaEden search
      if (!mangaInfo) {
        try {
          const mangaEdenResults = await searchMangaEden(id, 1, 20);
          if (mangaEdenResults.results.length > 0) {
            const mangaEdenInfo = await getMangaEdenInfo(mangaEdenResults.results[0].id);
            if (mangaEdenInfo) {
              mangaInfo = mangaEdenInfo;
              chapters = mangaEdenInfo.chapters || [];
              chapters = chapters.map((ch: any) => ({
                ...ch,
                provider: 'mangaeden',
              }));
              console.log('[MangaInfo] Found manga on MangaEden, chapters:', chapters.length);
            }
          }
        } catch (error) {
          console.error('[MangaInfo] Error fetching from MangaEden:', error);
        }
      }
    }
    
    if (!mangaInfo) {
      return NextResponse.json({ error: 'Manga not found on any provider' }, { status: 404 });
    }

    let formattedChapters: Chapter[] = chapters.map((ch: any) => ({
      id: ch.id,
      chapter: ch.chapter,
      title: ch.title,
      lang: ch.translatedLanguage || ch.lang,
      provider: ch.provider || 'mangadex' as const,
    }));

    // Always attempt to find Remanga and Mangalib chapters to merge Russian translations
    // Especially important when MangaDex has no chapters (common for Russian manga)
    if (mangaInfo.title) {
      let remangaSlug: string | null = null;
      let mangalibSlug: string | null = null;

      // First try direct search
      console.log(`[HybridReader] Attempting to find Remanga chapters for "${mangaInfo.title}"...`);
      remangaSlug = await searchRemangaSlug(mangaInfo.title, mangaInfo.altTitles || []);

      // If direct search fails, try Shikimori as a fallback to find the correct slugs
      if (!remangaSlug || !mangalibSlug) {
        console.log(`[HybridReader] Direct search incomplete, trying Shikimori for slug discovery...`);
        const shikimoriLinks = await searchShikimoriMangaLinks(mangaInfo.title, mangaInfo.altTitles || []);
        
        if (shikimoriLinks.remangaSlug && !remangaSlug) {
          remangaSlug = shikimoriLinks.remangaSlug;
          console.log(`[HybridReader] Shikimori found Remanga slug: ${remangaSlug}`);
        }
        
        if (shikimoriLinks.mangalibSlug && !mangalibSlug) {
          mangalibSlug = shikimoriLinks.mangalibSlug;
          console.log(`[HybridReader] Shikimori found Mangalib slug: ${mangalibSlug}`);
        }
      }

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

        // After Remanga merge, prepare for Mangalib fallback by storing Remanga IDs
        const remangaChapterMap = new Map<string, string>();
        remangaFormatted.forEach(ch => {
          remangaChapterMap.set(`${ch.chapter}_${ch.lang}`, ch.id);
        });

        formattedChapters = Array.from(chapterMap.values());
        console.log(`[HybridReader] Total chapters after Remanga merge: ${formattedChapters.length}`);
      } else {
        console.log(`[HybridReader] No Remanga slug found for "${mangaInfo.title}"`);
      }

      // Try Mangalib as additional Russian source (if not already found via Shikimori)
      if (!mangalibSlug) {
        console.log(`[HybridReader] Attempting to find Mangalib chapters for "${mangaInfo.title}"...`);
        mangalibSlug = await searchMangalibSlug(mangaInfo.title, mangaInfo.altTitles || []);
      }

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
          const existing = chapterMap.get(key);
          
          // If Remanga chapter exists, store Mangalib ID as fallback for it
          if (existing && existing.provider === 'remanga') {
            existing.mangalibId = ch.id; // Store Mangalib ID as fallback for Remanga
          }
          
          // If MangaDex chapter exists, store MangaDex ID as fallback
          if (existing && existing.provider === 'mangadex') {
            ch.fallbackId = existing.id; // Store MangaDex ID as fallback
          }
          
          // If Remanga exists, don't override with Mangalib (Remanga is prioritized for Russian)
          if (!existing || existing.provider !== 'remanga') {
            chapterMap.set(key, ch);
          }
        });

        formattedChapters = Array.from(chapterMap.values());
        console.log(`[HybridReader] Total chapters after Mangalib merge: ${formattedChapters.length}`);
      } else {
        console.log(`[HybridReader] No Mangalib slug found for "${mangaInfo.title}"`);
      }

      // Try Comick as additional source
      console.log(`[HybridReader] Attempting to find Comick chapters for "${mangaInfo.title}"...`);
      const comickResults = await searchComick(mangaInfo.title, 1);
      if (comickResults.length > 0) {
        const comickId = comickResults[0].id;
        console.log(`[HybridReader] Found Comick ID "${comickId}" for "${mangaInfo.title}". Fetching chapters...`);
        const comickChapters = await getComickChapters(comickId);
        console.log(`[HybridReader] Comick returned ${comickChapters.length} chapters`);
        
        const comickFormatted: Chapter[] = comickChapters.map(ch => ({
          id: ch.id,
          chapter: ch.chapter,
          title: ch.title,
          lang: ch.lang,
          provider: 'comick' as const,
        }));

        // Merge with existing chapters
        const chapterMap = new Map<string, Chapter>();
        
        // Add existing chapters first
        formattedChapters.forEach(ch => {
          const key = `${ch.chapter}_${ch.lang}`;
          chapterMap.set(key, ch);
        });

        // Add Comick chapters
        comickFormatted.forEach(ch => {
          const key = `${ch.chapter}_${ch.lang}`;
          const existing = chapterMap.get(key);
          
          // Store fallback IDs from other providers
          if (existing && existing.provider === 'mangadex') {
            ch.fallbackId = existing.id;
          }
          if (existing && existing.provider === 'remanga') {
            ch.mangalibId = existing.mangalibId;
          }
          if (existing && existing.provider === 'mangalib') {
            ch.mangalibId = existing.id;
          }
          
          // Comick doesn't override existing Russian translations (Remanga/Mangalib prioritized)
          if (ch.lang !== 'ru' || !existing || (existing.provider !== 'remanga' && existing.provider !== 'mangalib')) {
            chapterMap.set(key, ch);
          }
        });

        formattedChapters = Array.from(chapterMap.values());
        console.log(`[HybridReader] Total chapters after Comick merge: ${formattedChapters.length}`);
      } else {
        console.log(`[HybridReader] No Comick results found for "${mangaInfo.title}"`);
      }

      // Try MangaEden as additional source
      console.log(`[HybridReader] Attempting to find MangaEden chapters for "${mangaInfo.title}"...`);
      const mangaEdenResults = await searchMangaEden(mangaInfo.title, 1, 20);
      if (mangaEdenResults.results.length > 0) {
        const mangaEdenId = mangaEdenResults.results[0].id;
        console.log(`[HybridReader] Found MangaEden ID "${mangaEdenId}" for "${mangaInfo.title}". Fetching info...`);
        const mangaEdenInfo = await getMangaEdenInfo(mangaEdenId);
        
        if (mangaEdenInfo?.chapters && mangaEdenInfo.chapters.length > 0) {
          console.log(`[HybridReader] MangaEden returned ${mangaEdenInfo.chapters.length} chapters`);
          
          const mangaEdenFormatted: Chapter[] = mangaEdenInfo.chapters.map((ch: any) => ({
            id: ch.id,
            chapter: ch.chapter,
            title: ch.title,
            lang: ch.lang,
            provider: 'mangaeden' as const,
          }));

          // Merge with existing chapters
          const chapterMap = new Map<string, Chapter>();
          
          // Add existing chapters first
          formattedChapters.forEach(ch => {
            const key = `${ch.chapter}_${ch.lang}`;
            chapterMap.set(key, ch);
          });

          // Add MangaEden chapters
          mangaEdenFormatted.forEach(ch => {
            const key = `${ch.chapter}_${ch.lang}`;
            const existing = chapterMap.get(key);
            
            // Store fallback IDs from other providers
            if (existing && existing.provider === 'mangadex') {
              ch.fallbackId = existing.id;
            }
            if (existing && existing.provider === 'remanga') {
              ch.mangalibId = existing.mangalibId;
            }
            if (existing && existing.provider === 'mangalib') {
              ch.mangalibId = existing.id;
            }
            if (existing && existing.provider === 'comick') {
              ch.comickId = existing.id;
            }
            
            // MangaEden doesn't override existing Russian translations
            if (ch.lang !== 'ru' || !existing || (existing.provider !== 'remanga' && existing.provider !== 'mangalib')) {
              chapterMap.set(key, ch);
            }
          });

          formattedChapters = Array.from(chapterMap.values());
          console.log(`[HybridReader] Total chapters after MangaEden merge: ${formattedChapters.length}`);
        }
      } else {
        console.log(`[HybridReader] No MangaEden results found for "${mangaInfo.title}"`);
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
