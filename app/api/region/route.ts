import { NextResponse } from 'next/server'

type RegionPayload = {
  country_name: string | null
  country_code: string | null
  source: string | null
}

const normalize = (input: unknown): RegionPayload => {
  const obj = (input ?? {}) as Record<string, unknown>

  const countryName =
    (typeof obj.country_name === 'string' && obj.country_name) ||
    (typeof obj.country === 'string' && obj.country) ||
    null

  const countryCode =
    (typeof obj.country_code === 'string' && obj.country_code) ||
    (typeof obj.countryCode === 'string' && obj.countryCode) ||
    (typeof obj.country_code2 === 'string' && obj.country_code2) ||
    null

  return {
    country_name: countryName,
    country_code: countryCode,
    source: null,
  }
}

const fetchJson = async (url: string, timeoutMs: number) => {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    })

    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function GET() {
  try {
    const sources: Array<{ name: string; url: string }> = [
      { name: 'ipapi.co', url: 'https://ipapi.co/json/' },
      { name: 'ip-api.com', url: 'http://ip-api.com/json/' },
    ]

    for (const s of sources) {
      const raw = await fetchJson(s.url, 5000)
      if (!raw) continue

      const normalized = normalize(raw)
      if (normalized.country_name || normalized.country_code) {
        normalized.source = s.name
        return NextResponse.json(normalized, { status: 200 })
      }
    }

    return NextResponse.json(
      { country_name: null, country_code: null, source: null },
      { status: 200 },
    )
  } catch (error) {
    console.error('Region API error:', error)
    return NextResponse.json(
      { country_name: null, country_code: null, source: null },
      { status: 200 },
    )
  }
}
