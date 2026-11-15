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
  for (const [animeId, subscriptions] of byAnime) {
    try {
      if (!/^\d+$/.test(animeId)) continue
      const aired = await fetchEpisodes(animeId)
      if (!Number.isInteger(aired)) continue
      for (const subscription of subscriptions) {
        // First sight of this subscription after linking: the cursor is empty,
        // and baseline_episode may be months old (it was recorded when the person
        // subscribed on the website). Notifying now would fire a backlog of
        // "episode N is out" for everything that aired since — exactly what the
        // website never does. So the first scan only seeds the cursor with what
        // has already aired; notifications start from the NEXT episode.
        if (subscription.telegram_episode == null) {
          await db.query(`INSERT INTO telegram_episode_cursors (subscription_id, link_id, episode)
            VALUES ($1, $2, $3) ON CONFLICT (subscription_id, link_id)
            DO UPDATE SET episode = GREATEST(telegram_episode_cursors.episode, EXCLUDED.episode)`,
          [subscription.id, subscription.link_id, aired])
          continue
        }
        if (!shouldNotify(subscription, aired, subscription.telegram_episode)) continue
        // Re-read website settings immediately before delivery, not just at scan start.
        const { rows: active } = await db.query(`SELECT s.id FROM title_subscriptions s
          JOIN telegram_links l ON l.user_id = s.user_id
          WHERE s.id = $1 AND l.id = $2 AND l.notifications_enabled
          AND s.notify_new_episodes AND s.baseline_episode < $3`,
        [subscription.id, subscription.link_id, aired])
        if (!active.length) continue
        await telegram('sendMessage', {
          chat_id: subscription.chat_id,
          text: `${String(subscription.anime_title || `Аниме #${animeId}`).slice(0, 250)}: вышла серия ${aired}.\n${siteUrl}/watch/${animeId}?episode=${aired}`,
        })
        // Separate cursor: website notifications must not consume Telegram deliveries.
        await db.query(`INSERT INTO telegram_episode_cursors (subscription_id, link_id, episode)
          VALUES ($1, $2, $3) ON CONFLICT (subscription_id, link_id)
          DO UPDATE SET episode = GREATEST(telegram_episode_cursors.episode, EXCLUDED.episode)`,
        [subscription.id, subscription.link_id, aired])
      }
    } catch {
      // Never log raw fetch errors: Telegram request URLs contain the bot token.
      console.error(`[telegram] Failed to check/deliver anime ${animeId}; retry next scan`)
    }
  }
}
