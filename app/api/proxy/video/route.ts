// --- START OF FILE app/api/proxy/video/route.ts ---
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return new NextResponse("Missing URL", { status: 400 })
  }

  try {
    // Делаем запрос к реальному видео-файлу
    // Важно передать Range заголовок для перемотки видео
    const range = request.headers.get("range")
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://hentasis1.top/", // Обходим защиту от хотлинка
        ...(range && { Range: range }),
      },
    })

    if (!response.ok) {
      return new NextResponse(`Failed to fetch video: ${response.statusText}`, { status: response.status })
    }

    // Копируем заголовки ответа (Content-Type, Content-Length, Content-Range)
    const headers = new Headers()
    response.headers.forEach((value, key) => {
      if (['content-length', 'content-type', 'content-range', 'accept-ranges'].includes(key.toLowerCase())) {
        headers.set(key, value)
      }
    })

    // Возвращаем поток
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })

  } catch (error) {
    console.error("Proxy error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}