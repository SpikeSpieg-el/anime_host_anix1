import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Web Search] Received body:', body)
    
    const { query, numResults = 5 } = body

    if (!query) {
      console.error('[Web Search] Query is missing. Body keys:', Object.keys(body))
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Using DuckDuckGo Instant Answer API (free, no API key needed)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`

    console.log('[Web Search] Query:', query)
    let data: any = null
    
    try {
      const response = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        // Add mode: cors for cross-origin requests
        mode: 'cors'
      })

      if (!response.ok) {
        console.error('[Web Search] DDG Response status:', response.status)
        throw new Error(`DuckDuckGo API error: ${response.status}`)
      }

      data = await response.json()
    } catch (ddgError) {
      console.error('[Web Search] DuckDuckGo failed, using Wikipedia fallback:', ddgError)
    }

    // Extract relevant information from DuckDuckGo response
    const results = []

    // Add Abstract if available
    if (data?.Abstract) {
      results.push({
        title: data.Heading || query,
        snippet: data.Abstract,
        url: data.AbstractURL || data.AbstractSource
      })
    }

    // Add RelatedTopics if available
    if (data?.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, numResults)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            snippet: topic.Text,
            url: topic.FirstURL
          })
        }
      }
    }

    // Fallback to external search if DuckDuckGo doesn't return enough results or failed
    if (results.length < 3) {
      // Use Wikipedia API as fallback
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=${numResults}`
      
      try {
        const wikiResponse = await fetch(wikiUrl)
        const wikiData = await wikiResponse.json()
        
        if (wikiData.query?.search) {
          for (const item of wikiData.query.search.slice(0, numResults)) {
            results.push({
              title: item.title,
              snippet: item.snippet.replace(/<[^>]*>/g, ''),
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
            })
          }
        }
      } catch (wikiError) {
        console.error('[Web Search] Wikipedia fallback failed:', wikiError)
      }
    }

    console.log(`[Web Search] Found ${results.length} results`)

    return NextResponse.json({
      success: true,
      data: results.slice(0, numResults)
    })

  } catch (error) {
    console.error('[Web Search] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
