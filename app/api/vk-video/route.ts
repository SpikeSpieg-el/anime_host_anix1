// app/api/vk-video/route.ts
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get("title")
  const episode = searchParams.get("episode")

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const token = process.env.VK_SERVICE_KEY

  if (!token) {
    console.error("VK_SERVICE_KEY is missing")
    return NextResponse.json({ embedSrc: null })
  }

  // Формируем поисковый запрос
  // Добавляем "озвучка" или "русская озвучка", чтобы исключить raw/sub версии, если нужно
  const query = `${title} ${episode} серия`

  try {
    // Параметры API VK
    const params = new URLSearchParams({
      access_token: token,
      v: "5.199", // Версия API
      q: query,
      sort: "2", // 2 — по релевантности
      hd: "1", // Искать HD
      count: "5", // Берем топ-5, чтобы отфильтровать
      adult: "0",
    })

    const response = await fetch(`https://api.vk.com/method/video.search?${params}`, {
      next: { revalidate: 3600 }, // Кешируем запрос на час
    })

    const data = await response.json()

    if (data.error) {
      console.error("VK API Error:", data.error)
      return NextResponse.json({ embedSrc: null })
    }

    const items = data.response?.items || []

    if (items.length === 0) {
      return NextResponse.json({ embedSrc: null })
    }

    // Берем первое видео. Поле 'player' содержит ссылку на iframe (video_ext.php)
    // VK обычно возвращает ссылку вида https://vk.com/video_ext.php?...
    const bestMatch = items[0]
    
    // Иногда API возвращает http, меняем на https для безопасности
    let embedSrc = bestMatch.player
    if (embedSrc && embedSrc.startsWith("http:")) {
      embedSrc = embedSrc.replace("http:", "https:")
    }

    return NextResponse.json({ embedSrc })

  } catch (error) {
    console.error("Failed to fetch VK video:", error)
    return NextResponse.json({ embedSrc: null }, { status: 500 })
  }
}