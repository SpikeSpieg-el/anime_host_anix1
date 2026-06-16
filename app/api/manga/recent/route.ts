import { NextRequest, NextResponse } from 'next/server';
import { getRecentManga } from '@/lib/mangadex/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    const results = await getRecentManga(limit, offset);
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
    console.error('Error getting recent manga:', error);
    return NextResponse.json({ error: 'Failed to get recent manga' }, { status: 500 });
  }
}
