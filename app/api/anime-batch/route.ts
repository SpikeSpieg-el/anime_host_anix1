import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (!idsParam) {
      return NextResponse.json({ anime: [] })
    }

    const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))

    if (ids.length === 0) {
      return NextResponse.json({ anime: [] })
    }

    const results: { id: number; name: string; russian: string | null; imageUrl: string | null }[] = []

    await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`https://shikimori.one/api/animes/${id}`, {
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          results.push({
            id,
            name: data.name || '',
            russian: data.russian || null,
            imageUrl: data.image?.original ? `https://shikimori.one${data.image.original}` : null,
          })
        }
      } catch {
        // skip failed fetches
      }
    }))

    return NextResponse.json({ anime: results })
  } catch (error) {
    console.error('[anime-batch] Error:', error)
    return NextResponse.json({ anime: [] })
  }
}
