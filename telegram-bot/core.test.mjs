import test from 'node:test'
import assert from 'node:assert/strict'
import { commandOf, createCode, errorLabel, shouldNotify, scanEpisodes } from './core.mjs'

test('codes match the existing website API', () => {
  for (let i = 0; i < 100; i++) assert.match(createCode(), /^[A-HJ-NP-Z2-9]{8}$/)
})
test('only private user commands are accepted', () => {
  assert.equal(commandOf({ chat: { type: 'group' }, text: '/link' }), null)
  assert.equal(commandOf({ chat: { type: 'private' }, from: { is_bot: true }, text: '/link' }), null)
  assert.equal(commandOf({ chat: { type: 'private' }, text: '/sync@WeebxBot' }), '/sync')
  assert.equal(commandOf(undefined), null)
})
test('baseline, Telegram cursor and explicit episode preference are respected', () => {
  const s = { baseline_episode: 5, notify_new_episodes: true, last_notified_episode: 99 }
  assert.equal(shouldNotify(s, 5, null), false)
  assert.equal(shouldNotify(s, 6, null), true) // website cursor cannot swallow Telegram
  assert.equal(shouldNotify(s, 6, 6), false)
  assert.equal(shouldNotify(s, 7, 6), true)
  for (const invalid of [null, NaN, '7', -1]) assert.equal(shouldNotify(s, invalid, null), false)
  assert.equal(shouldNotify({ ...s, notify_new_episodes: false }, 7, null), false)
})

test('runtime logs use only safe HTTP, network and database error codes', () => {
  const raw = new Error('https://api.telegram.org/bot123:secret/sendMessage')
  assert.equal(errorLabel(raw), 'unknown error')
  assert.equal(errorLabel({ code: raw.message }), 'unknown error')
  assert.equal(errorLabel({ status: 409, message: raw.message }), 'HTTP 409')
  assert.equal(errorLabel({ cause: { code: 'ECONNRESET' } }), 'ECONNRESET')
  assert.equal(errorLabel({ code: '42P01' }), '42P01')
})

function fixture({ active = true, cursor = 0, animeIds = ['123', '123'] } = {}) {
  const writes = [], messages = [], fetches = [], events = []
  const blocked = new Set(), unwritable = new Set()
  const rows = animeIds.map((anime_id, i) => ({
    id: `s${i + 1}`, link_id: `l${i + 1}`, chat_id: String(42 + i), anime_id, anime_title: 'Test',
    baseline_episode: 3, notify_new_episodes: true, last_notified_episode: 99, telegram_episode: cursor,
  }))
  let aired = 4
  const db = { query: async (sql, args) => {
    if (sql.includes('LEFT JOIN')) return { rows: rows.map(row => ({ ...row })) }
    const [id, link, episode] = args
    const row = rows.find(item => item.id === id && item.link_id === link)
    assert.ok(row)
    if (sql.includes('INSERT')) {
      if (unwritable.has(id)) throw Object.assign(new Error('cursor write failed'), { code: '23503' })
      writes.push(args)
      events.push(`write:${id}`)
      row.telegram_episode = Math.max(row.telegram_episode ?? 0, episode)
      return { rows: [] }
    }
    return { rows: active ? [{ id }] : [] }
  } }
  return { writes, messages, fetches, events, blocked, unwritable, setAired: n => { aired = n }, args: {
    db, siteUrl: 'https://example.com',
    fetchEpisodes: async id => { fetches.push(id); return aired },
    telegram: async (method, body) => {
      assert.equal(method, 'sendMessage')
      if (blocked.has(body.chat_id)) throw Object.assign(new Error('blocked'), { status: 403 })
      messages.push(body)
      events.push(`send:${body.chat_id}`)
    },
  } }
}

test('one source request per title, with each cursor written after delivery', async () => {
  const f = fixture()
  const stats = await scanEpisodes(f.args)
  assert.deepEqual(f.fetches, ['123'])
  assert.deepEqual(f.events, ['send:42', 'write:s1', 'send:43', 'write:s2'])
  assert.match(f.messages[0].text, /episode=4/)
  assert.equal(stats.sent, 2)
  assert.equal(stats.checked, 1)
})

test('a blocked chat keeps its cursor without preventing delivery to others', async t => {
  const log = t.mock.method(console, 'error', () => {})
  const f = fixture()
  f.blocked.add('42')
  const stats = await scanEpisodes(f.args)
  assert.equal(stats.sendErrors, 1)
  assert.equal(stats.sent, 1)
  assert.match(log.mock.calls[0].arguments[0], /Telegram sendMessage.*HTTP 403/)
  assert.deepEqual(f.messages.map(m => m.chat_id), ['43'])
  assert.deepEqual(f.writes, [['s2', 'l2', 4]])

  f.blocked.clear()
  await scanEpisodes(f.args)
  assert.deepEqual(f.messages.map(m => m.chat_id), ['43', '42'])
})

test('a cursor write failure is reported separately and does not prevent later deliveries', async t => {
  const log = t.mock.method(console, 'error', () => {})
  const f = fixture()
  f.unwritable.add('s1')
  const stats = await scanEpisodes(f.args)
  assert.equal(stats.sent, 2) // accepted by Telegram despite one failed cursor write
  assert.equal(stats.dbErrors, 1)
  assert.equal(stats.sendErrors, 0)
  assert.match(log.mock.calls[0].arguments[0], /save cursor failed.*23503/)
  assert.deepEqual(f.writes, [['s2', 'l2', 4]])
})

test('source failures and invalid episode data do not affect other titles', async t => {
  const log = t.mock.method(console, 'error', () => {})
  const f = fixture({ animeIds: ['123', '456', '789', 'not-numeric'] })
  f.args.fetchEpisodes = async id => {
    if (id === '123') throw Object.assign(new Error('rate limit'), { status: 429 })
    if (id === '456') return -1
    assert.equal(id, '789')
    return 5
  }
  const stats = await scanEpisodes(f.args)
  assert.deepEqual(stats, { subscriptions: 4, titles: 4, checked: 1, seeded: 0, sent: 1,
    invalidIds: 1, sourceErrors: 2, sendErrors: 0, dbErrors: 0 })
  assert.match(log.mock.calls[0].arguments[0], /Shikimori failed for anime 123.*HTTP 429/)
  assert.match(log.mock.calls[1].arguments[0], /invalid episodes_aired for anime 456/)
  assert.deepEqual(f.writes, [['s3', 'l3', 5]])
})

test('muted/unlinked during scan or already delivered: no delivery', async () => {
  for (const options of [{ active: false }, { cursor: 4 }]) {
    const f = fixture(options)
    const stats = await scanEpisodes(f.args)
    assert.equal(stats.sent, 0)
    assert.deepEqual(f.events, [])
  }
})

test('first scan seeds silently, then a new episode is sent once per subscriber', async () => {
  const f = fixture({ cursor: null })
  const first = await scanEpisodes(f.args)
  assert.equal(first.sent, 0)
  assert.equal(first.seeded, 2)
  assert.deepEqual(f.writes, [['s1', 'l1', 4], ['s2', 'l2', 4]])
  assert.equal((await scanEpisodes(f.args)).sent, 0)

  f.setAired(5)
  assert.equal((await scanEpisodes(f.args)).sent, 2)
  assert.ok(f.messages.every(m => m.text.endsWith('/watch/123?episode=5')))
  assert.equal((await scanEpisodes(f.args)).sent, 0)
})

test('a scan with no eligible subscriptions returns a zero summary', async () => {
  const f = fixture({ animeIds: [] })
  const stats = await scanEpisodes(f.args)
  assert.deepEqual(stats, { subscriptions: 0, titles: 0, checked: 0, seeded: 0, sent: 0,
    invalidIds: 0, sourceErrors: 0, sendErrors: 0, dbErrors: 0 })
  assert.deepEqual(f.fetches, [])
})
