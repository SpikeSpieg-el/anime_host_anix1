import { randomInt } from 'node:crypto'

export function createCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

export function commandOf(message) {
  if (message?.chat?.type !== 'private' || message.from?.is_bot) return null
  return (message.text || '').trim().split(/\s/)[0].split('@')[0].toLowerCase()
}

export function shouldNotify(subscription, aired, cursor) {
  return subscription.notify_new_episodes === true && Number.isInteger(aired) &&
    aired > Math.max(0, Number(subscription.baseline_episode) || 0, Number(cursor) || 0)
}

export function errorLabel(error) {
  // Never log raw errors here: fetch URLs can contain the bot token.
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
    return `HTTP ${error.status}`
  }
  for (const code of [error?.code, error?.cause?.code]) {
    if (typeof code === 'string' && /^(?:[0-9A-Z]{5}|E[A-Z_]{2,39}|UND_ERR_[A-Z_]{1,30})$/.test(code)) return code
  }
  if (error?.name === 'TimeoutError') return 'timeout'
  if (error instanceof SyntaxError) return 'invalid JSON'
  return 'unknown error'
}

const SAVE_CURSOR = `INSERT INTO telegram_episode_cursors (subscription_id, link_id, episode)
  VALUES ($1, $2, $3) ON CONFLICT (subscription_id, link_id)
  DO UPDATE SET episode = GREATEST(telegram_episode_cursors.episode, EXCLUDED.episode)`

export async function scanEpisodes({ db, telegram, fetchEpisodes, siteUrl }) {
  const { rows } = await db.query(`
    SELECT s.*, l.id AS link_id, l.chat_id, c.episode AS telegram_episode
    FROM title_subscriptions s
    JOIN telegram_links l ON l.user_id = s.user_id
    LEFT JOIN telegram_episode_cursors c ON c.subscription_id = s.id AND c.link_id = l.id
    WHERE s.notify_new_episodes AND l.notifications_enabled
    ORDER BY s.anime_id, s.id`)
  const byAnime = Map.groupBy ? Map.groupBy(rows, row => row.anime_id) : rows.reduce((map, row) => {
    if (!map.has(row.anime_id)) map.set(row.anime_id, [])
    map.get(row.anime_id).push(row)
    return map
  }, new Map())
  const stats = { subscriptions: rows.length, titles: byAnime.size, checked: 0, seeded: 0, sent: 0,
    invalidIds: 0, sourceErrors: 0, sendErrors: 0, dbErrors: 0 }
  for (const [animeId, subscriptions] of byAnime) {
    if (!/^\d+$/.test(animeId)) { stats.invalidIds++; continue }
    let aired
    try {
      aired = await fetchEpisodes(animeId)
    } catch (error) {
      stats.sourceErrors++
      console.error(`[telegram] Episode scan Shikimori failed for anime ${animeId} (${errorLabel(error)})`)
      continue
    }
    if (!Number.isInteger(aired) || aired < 0) {
      stats.sourceErrors++
      console.error(`[telegram] Episode scan Shikimori returned invalid episodes_aired for anime ${animeId}`)
      continue
    }
    stats.checked++
    for (const subscription of subscriptions) {
      let stage = 'initialize cursor'
      try {
        const cursorParams = [subscription.id, subscription.link_id, aired]
        // An existing site subscription may have an old baseline. The first
        // Telegram scan records what has already aired without sending a backlog.
        if (subscription.telegram_episode == null) {
          await db.query(SAVE_CURSOR, cursorParams)
          stats.seeded++
          continue
        }
        if (!shouldNotify(subscription, aired, subscription.telegram_episode)) continue
        // Re-read website settings immediately before delivery, not just at scan start.
        stage = 'recheck subscription'
        const { rows: active } = await db.query(`SELECT s.id FROM title_subscriptions s
          JOIN telegram_links l ON l.user_id = s.user_id
          WHERE s.id = $1 AND l.id = $2 AND l.notifications_enabled
          AND s.notify_new_episodes AND s.baseline_episode < $3`, cursorParams)
        if (!active.length) continue
        stage = 'Telegram sendMessage'
        await telegram('sendMessage', {
          chat_id: subscription.chat_id,
          text: `${String(subscription.anime_title || `Аниме #${animeId}`).slice(0, 250)}: вышла серия ${aired}.\n${siteUrl}/watch/${animeId}?episode=${aired}`,
        })
        stats.sent++
        // Separate cursor: website notifications must not consume Telegram deliveries.
        stage = 'save cursor'
        await db.query(SAVE_CURSOR, cursorParams)
      } catch (error) {
        // A blocked chat or a deleted subscription must not skip other recipients.
        if (stage === 'Telegram sendMessage') stats.sendErrors++
        else stats.dbErrors++
        console.error(`[telegram] Episode scan ${stage} failed for anime ${animeId} (${errorLabel(error)})`)
      }
    }
  }
  return stats
}
