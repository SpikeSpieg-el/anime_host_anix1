import { spawn } from 'node:child_process'
import { ReadableStream } from 'node:stream'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Админский endpoint для экспорта данных Umami в CSV.
 *
 * Запускает утилиту `@openpanel/umami-exporter` как подпроцесс на сервере:
 * она подключается к Postgres, объединяет события и сессии и выводит готовый
 * CSV-файл (на stdout). Вывод потоково передаётся клиенту как скачиваемый файл.
 *
 * Безопасность: строка подключения НЕ вставляется в shell — передаётся как единый
 * аргумент spawn, поэтому инъекции через URL невозможны.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXPORTER_TOOL = '@openpanel/umami-exporter'

function readAdminAuth(): boolean {
  return cookies().then((store) => store.get('admin_auth')?.value === 'true')
}

/** Минимальная проверка формата строки подключения Postgres. */
export function isValidPostgresUrl(raw: string): boolean {
  if (!raw || !raw.includes('://')) return false
  try {
    // Разбираем как URL, чтобы отсечь мусор и инъекции.
    const url = new URL(raw)
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await readAdminAuth()
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      )
    }

    const payload = (await request.json()) as {
      databaseUrl?: string
      websiteId?: string
      jobId?: string
    }

    const databaseUrl = String(payload.databaseUrl ?? '').trim()
    if (!isValidPostgresUrl(databaseUrl)) {
      return NextResponse.json(
        { error: 'Неверная строка подключения к базе данных. Ожидается postgres://...' },
        { status: 400 }
      )
    }

    // Потоковая передача вывода утилиты как скачиваемого CSV-файла.
    const proc = spawn('npx', [EXPORTER_TOOL, databaseUrl, '--output', '-'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })

    const stream = new ReadableStream({
      start(controller) {
        try {
          proc.stdout.on('data', (chunk: Buffer) => controller.enqueue(chunk))
          proc.stderr.on('data', (chunk: Buffer) => console.error('[analytics-export]', chunk.toString().trim()))
          proc.on('error', (err) => controller.error(err))
          proc.on('close', () => controller.close())
        } catch (err) {
          controller.error(err)
        }
      },
    })

    const filename = `umami-export-${Date.now()}.csv`
    return new NextResponse(stream, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[analytics-export] failed:', error)
    return NextResponse.json(
      { error: 'Не удалось запустить экспорт. Проверьте строку подключения к базе данных.' },
      { status: 502 }
    )
  }
}
