// app/api/admin/analytics-export/route.ts
import { Pool, PoolClient } from 'pg'
import QueryStream from 'pg-query-stream'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_AUTH_COOKIE, isValidAdminSession } from '@/lib/admin-auth'
import { csvField } from '@/lib/csv'
import { getRateLimitKey, rateLimiters } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const pool = new Pool({
  connectionString: process.env.UMAMI_DATABASE_URL,
  max: 3,
})

/**
 * Потолок одной выгрузки.
 *
 * Запрос раньше шёл без LIMIT вообще: один запрос с авторизованной сессией
 * вытягивал всю таблицу website_event целиком. Пул соединений при этом
 * max: 3, поэтому три параллельные выгрузки занимали его целиком и
 * следующий запрос уходил в ожидание.
 */
const MAX_EXPORT_ROWS = 100_000

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const isAdmin = isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.UMAMI_DATABASE_URL) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 })
    }

    // Выгрузка — самая тяжёлая операция в админке, поэтому ограничиваем
    // её по числу обращений с одного адреса.
    const limitKey = getRateLimitKey(request)
    if (limitKey) {
      const limit = rateLimiters.strict.checkLimit(`analytics-export:${limitKey}`)
      if (!limit.success) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
        )
      }
    }

    const { searchParams } = new URL(request.url)
    // websiteId обязателен: без него запрос выгружал события ВСЕХ сайтов,
    // установленных в этой базе Umami. Если администратор не передал его
    // явно, берём из env — в панели поле ввода для него не нужно.
    const websiteId = (searchParams.get('websiteId')?.trim()
      || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
      || '').trim()
    if (!websiteId) {
      return NextResponse.json(
        { error: 'websiteId is required (set NEXT_PUBLIC_UMAMI_WEBSITE_ID)' },
        { status: 400 },
      )
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(websiteId)) {
      return NextResponse.json({ error: 'Invalid websiteId' }, { status: 400 })
    }

    const encoder = new TextEncoder()

    // Базовый запрос под Umami v2/v3.
    // Параметры идёт через $1 — значение пользователя в строку не склеивается.
    const sql = `
      SELECT
        e.event_id AS id,
        e.website_id,
        e.event_name,
        e.created_at AS timestamp,
        e.url_path,
        e.page_title
      FROM website_event e
      WHERE e.website_id = $1
      ORDER BY e.created_at DESC
      LIMIT ${MAX_EXPORT_ROWS}
    `
    const params: unknown[] = [websiteId]

    let client: PoolClient | null = null
    let queryStream: QueryStream | null = null

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          client = await pool.connect()

          controller.enqueue(
            encoder.encode('id,website_id,event_name,timestamp,url_path,page_title\n')
          )

          queryStream = client.query(new QueryStream(sql, params))

          queryStream.on('data', (row: any) => {
            const rowCsv = [
              row.id,
              row.website_id,
              row.event_name,
              row.timestamp ? new Date(row.timestamp).toISOString() : '',
              row.url_path,
              row.page_title,
            ].map(csvField).join(',') + '\n'

            controller.enqueue(encoder.encode(rowCsv))
          })

          queryStream.on('end', () => {
            client?.release()
            client = null
            controller.close()
          })

          queryStream.on('error', (err: Error) => {
            console.error('[analytics-export] query error:', err)
            client?.release()
            client = null
            controller.error(err)
          })
        } catch (err) {
          client?.release()
          client = null
          controller.error(err)
        }
      },
      cancel() {
        queryStream?.destroy()
        client?.release()
        client = null
      },
    })

    return new NextResponse(stream, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="analytics-${Date.now()}.csv"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[analytics-export] error:', error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}