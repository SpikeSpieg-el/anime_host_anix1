import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const title = searchParams.get('title')
  const shikimoriId = searchParams.get('shikimoriId')

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    // Парсим страницу озвучки для поиска правильного ID
    const ozvuchkaPage = await fetch('http://hentasis1.top/ozvuchka/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!ozvuchkaPage.ok) {
      throw new Error('Failed to fetch ozvuchka page')
    }

    const html = await ozvuchkaPage.text()
    
    // Ищем ссылку с названием аниме
    const linkRegex = new RegExp(`<a[^>]*class="short-link nowrap"[^>]*href="([^"]*)"[^>]*>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*</a>`, 'i')
    const match = html.match(linkRegex)

    if (match && match[1]) {
      const hentasisUrl = match[1]
      
      // Извлекаем ID из URL
      const idMatch = hentasisUrl.match(/\/(\d+)-/)
      const hentasisId = idMatch ? idMatch[1] : null
      
      return NextResponse.json({
        hentasisId,
        hentasisUrl,
        found: true
      })
    } else {
      // Если не нашли по точному названию, пробуем поиск по частям
      const titleWords = title.toLowerCase().split(' ').filter(word => word.length > 3)
      
      for (const word of titleWords) {
        const partialRegex = new RegExp(`<a[^>]*class="short-link nowrap"[^>]*href="([^"]*)"[^>]*>[^<]*${word}[^<]*</a>`, 'i')
        const partialMatch = html.match(partialRegex)
        
        if (partialMatch && partialMatch[1]) {
          const hentasisUrl = partialMatch[1]
          const idMatch = hentasisUrl.match(/\/(\d+)-/)
          const hentasisId = idMatch ? idMatch[1] : null
          
          return NextResponse.json({
            hentasisId,
            hentasisUrl,
            found: true,
            partial: true
          })
        }
      }
    }

    return NextResponse.json({
      found: false,
      message: 'Anime not found on hentasis1.top'
    })

  } catch (error) {
    console.error('Error parsing hentasis1.top:', error)
    return NextResponse.json({
      found: false,
      error: 'Failed to parse hentasis1.top'
    }, { status: 500 })
  }
}
