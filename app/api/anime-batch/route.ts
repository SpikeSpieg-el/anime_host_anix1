import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (!idsParam) {
      return NextResponse.json({ anime: [] })
    }

    const ids = Array.from(new Set(
      idsParam
        .split(',')
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0),
    )).slice(0, 50)

    if (ids.length === 0) {
      return NextResponse.json({ anime: [] })
    }

    // Один batch-запрос вместо N отдельных запросов. Помимо названия и постера
    // отдаём минимальные данные для профиля зрителя: жанры и студии.
    const response = await fetch(
      `https://shikimori.one/api/animes?ids=${ids.join(',')}&limit=${ids.length}`,
      {
        headers: { 'User-Agent': 'Weebx/1.0' },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!response.ok) {
      return NextResponse.json({ anime: [] })
    }

    const data = await response.json()
    const anime = Array.isArray(data)
      ? data.map((item: any) => ({
          id: Number(item.id),
          name: item.name || '',
          russian: item.russian || null,
          imageUrl: item.image?.original ? `https://shikimori.one${item.image.original}` : null,
          genres: Array.isArray(item.genres)
            ? item.genres.map((genre: any) => genre.russian || genre.name).filter(Boolean)
            : [],
          studios: Array.isArray(item.studios)
            ? item.studios.map((studio: any) => studio.name).filter(Boolean)
            : [],
          year: item.aired_on ? Number.parseInt(String(item.aired_on).slice(0, 4), 10) || null : null,
          kind: item.kind || null,
        }))
      : []

    return NextResponse.json({ anime })
  } catch (error) {
    console.error('[anime-batch] Error:', error)
    return NextResponse.json({ anime: [] })
  }
}
