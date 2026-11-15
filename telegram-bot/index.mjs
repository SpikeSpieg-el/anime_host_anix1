import pg from 'pg'
import { setTimeout as sleep } from 'node:timers/promises'
import { commandOf, createCode, scanEpisodes } from './core.mjs'

const token = process.env.TELEGRAM_BOT_TOKEN
const connectionString = process.env.DATABASE_URL
const siteUrl = new URL(process.env.SITE_URL || 'https://weeb-x.com').origin
const interval = Number(process.env.TELEGRAM_SCAN_INTERVAL_MS || 1800000)
if (!token || !connectionString) throw new Error('TELEGRAM_BOT_TOKEN and DATABASE_URL are required')
if (!Number.isFinite(interval) || interval < 60000) throw new Error('Scan interval must be >= 60000ms')
const db = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})
let stopping = false
const abort = new AbortController()
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; abort.abort() })
db.on('error', () => { console.error('[telegram] Database connection lost'); process.exit(1) })

async function telegram(method, body) {
  // Sequential requests, including deliveries, avoid global Telegram flood limits.
  await sleep(50)
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.any([abort.signal, AbortSignal.timeout(40000)]),
  })
  const data = await response.json()
  if (!data.ok) throw new Error(`Telegram API status ${data.error_code}`)
  return data.result
}

async function handle(message) {
  const command = commandOf(message)
  if (!command) return
  const chatId = message.chat.id
  const send = text => telegram('sendMessage', { chat_id: chatId, text })
  const settings = `${siteUrl}/link`
  if (command === '/link') {
    // Reuse a live code: repeated commands do not invalidate the user's browser tab.
    const { rows } = await db.query(`SELECT code FROM telegram_link_codes
      WHERE telegram_id = $1 AND status = 'pending' AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`, [message.from.id])
    const code = rows[0]?.code || createCode()
    if (!rows.length) await db.query(`INSERT INTO telegram_link_codes
      (code, telegram_id, telegram_username, expires_at) VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [code, message.from.id, message.from.username || null])
    return send(`Войдите в свой аккаунт на сайте и подтвердите привязку:\n${settings}?code=${code}\nКод: ${code} (действует до 10 минут). Никому его не сообщайте.\nПосле подтверждения: /sync`)
  }
  if (command === '/sync') {
    const { rows } = await db.query(`SELECT l.notifications_enabled,
      (SELECT count(*) FROM title_subscriptions s WHERE s.user_id = l.user_id AND s.notify_new_episodes) AS count
      FROM telegram_links l WHERE l.telegram_id = $1`, [message.from.id])
    if (!rows.length) return send('Аккаунт ещё не привязан. Отправьте /link.')
    return send(`Аккаунт подключён. Подписок на новые серии: ${rows[0].count}.\nTelegram-уведомления: ${rows[0].notifications_enabled ? 'включены' : 'выключены'}.\nПодписки синхронизируются автоматически с сайтом. Проверка серий — по расписанию.\nНастройки: ${settings}`)
  }
  return send(`Weebx · бот 0.1\n/link — привязать аккаунт через сайт\n/sync — проверить связь и подписки\nНовые серии проверяются автоматически. Подписки редактируются на страницах тайтлов, настройки Telegram — ${settings}`)
}

async function fetchEpisodes(id) {
  await sleep(1100) // Shikimori: <= 1 request/second, cache per title within each scan.
  const response = await fetch(`https://shikimori.one/api/animes/${id}`, {
    headers: { 'User-Agent': 'Weebx-Telegram/0.1' },
    signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
  })
  if (!response.ok) throw new Error('Episode source unavailable')
  return (await response.json()).episodes_aired
}

let startupStage = 'database connection'

async function main() {
  await db.connect()
  startupStage = 'single-instance lock'
  // Session lock requires direct Postgres or session-mode pooler, not transaction pooling.
  const { rows } = await db.query('SELECT pg_try_advisory_lock(85421001) AS locked')
  if (!rows[0].locked) throw new Error('Another bot instance is already running')
  startupStage = 'database schema / migrations'
  await db.query('SELECT subscription_id FROM telegram_episode_cursors LIMIT 0')
  await db.query('SELECT telegram_id FROM telegram_links LIMIT 0')
  await db.query('SELECT code FROM telegram_link_codes LIMIT 0')
  await db.query('SELECT anime_id FROM title_subscriptions LIMIT 0')
  startupStage = 'Telegram setMyCommands'
  await telegram('setMyCommands', { commands: [
    { command: 'start', description: 'Помощь' },
    { command: 'link', description: 'Привязать аккаунт' },
    { command: 'sync', description: 'Проверить синхронизацию' },
  ] })
  let offset = 0
  let nextScan = 0
  console.log('[telegram] Bot 0.1 started')
  while (!stopping) {
    try {
      if (Date.now() >= nextScan) {
        await scanEpisodes({ db, telegram, fetchEpisodes, siteUrl })
        await db.query('SELECT cleanup_telegram_link_codes()')
        nextScan = Date.now() + interval
      }
      const updates = await telegram('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] })
      for (const update of updates) {
        try { await handle(update.message) }
        catch { console.error('[telegram] Command failed; user can retry') }
        offset = update.update_id + 1
      }
    } catch {
      if (!stopping) { console.error('[telegram] Poll/scan failed; retrying'); await sleep(5000) }
    }
  }
}
main().catch(error => {
  const codes = new Set([
    'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH',
    'ENETUNREACH', 'ECONNRESET', 'EPIPE', '28P01', '28000', '3D000',
    '42P01', '42501', '53300', '57P03', 'XX000',
    'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'UND_ERR_CONNECT_TIMEOUT',
  ])
  const list = [error, error?.cause, ...(Array.isArray(error?.errors) ? error.errors : [])]
  const code = [...new Set(list.map(e => e?.code).filter(c => codes.has(c)))].join(',')
  const status = /^Telegram API status (\d{3})$/.exec(error?.message || '')?.[1]
  console.error(`[telegram] Startup failed at: ${startupStage}; type=${error?.name || 'Error'}${code ? `; code=${code}` : ''}${status ? `; Telegram status=${status}` : ''}`)
  process.exitCode = 1
})
  .finally(() => db.end().catch(() => {}))
