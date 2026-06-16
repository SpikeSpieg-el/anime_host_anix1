import { NextRequest, NextResponse } from 'next/server';
import { searchMangaDex, searchMangaDexByTags } from '@/lib/mangadex/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const tagsParam = searchParams.get('tags');
    const page = parseInt(searchParams.get('page') || '1', 10);

    const limit = 20;
    const offset = (page - 1) * limit;
    let results: any[] = [];

    if (tagsParam) {
      // Search by tags
      const tags = tagsParam.split(',').map(t => t.trim()).filter(t => t);
      results = await searchMangaDexByTags(tags, limit, offset);
    } else if (query) {
      // Search by query
      results = await searchMangaDex(query, limit, offset);
    } else {
      return NextResponse.json({ error: 'Query or tags parameter is required' }, { status: 400 });
    }

    return NextResponse.json({
      currentPage: page,
      hasNextPage: results.length === limit,
      results: results.map((m: { id: string; title: string; image?: string; altTitles?: string[] }) => ({
        id: m.id,
        title: m.title,
        image: m.image,
        altTitles: m.altTitles,
      })),
    });
  } catch (error) {
    console.error('Error searching manga:', error);
    return NextResponse.json({ error: 'Failed to search manga' }, { status: 500 });
  }
}
