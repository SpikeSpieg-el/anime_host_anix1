// app/api/admin/analytics-export/route.ts
import { Pool, PoolClient } from 'pg'
import QueryStream from 'pg-query-stream'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const pool = new Pool({
  connectionString: process.env.UMAMI_DATABASE_URL,
  max: 3,
})

function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const isAdmin = cookieStore.get('admin_auth')?.value === 'true'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.UMAMI_DATABASE_URL) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const websiteId = searchParams.get('websiteId')

    const encoder = new TextEncoder()

    // Базовый запрос под Umami v2/v3
    let sql = `
      SELECT 
        e.event_id AS id,
        e.website_id,
        e.event_name,
        e.created_at AS timestamp,
        e.url_path,
        e.page_title
      FROM website_event e
    `
    const params: unknown[] = []

    if (websiteId) {
      params.push(websiteId)
      sql += ` WHERE e.website_id = $1`
    }

    sql += ` ORDER BY e.created_at DESC`

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