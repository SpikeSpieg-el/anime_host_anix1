import { NextResponse } from "next/server"
import { getPopularNow, getPopularAlways, getOngoingList, getForumNews, getAnnouncements } from "@/lib/shikimori"

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fields = searchParams.get("fields")?.split(",") ?? ["popularNow", "popularAlways", "ongoingAnime", "newsUpdates", "announcements"]

  const results: Record<string, any> = {}

  await Promise.all([
    fields.includes("popularNow") &&
      withTimeout(getPopularNow(12), []).then((d) => { results.popularNow = d }),
    fields.includes("popularAlways") &&
      withTimeout(getPopularAlways(12), []).then((d) => { results.popularAlways = d }),
    fields.includes("ongoingAnime") &&
      withTimeout(getOngoingList(12), []).then((d) => { results.ongoingAnime = d }),
    fields.includes("newsUpdates") &&
      withTimeout(getForumNews(5), []).then((d) => { results.newsUpdates = d }),
    fields.includes("announcements") &&
      withTimeout(getAnnouncements(3), []).then((d) => { results.announcements = d }),
  ])

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
  })
}
