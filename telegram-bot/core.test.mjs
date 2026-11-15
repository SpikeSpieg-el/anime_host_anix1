import test from 'node:test'
import assert from 'node:assert/strict'
import { commandOf, createCode, shouldNotify, scanEpisodes } from './core.mjs'

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

function fixture({ sendFails = false, active = true, cursor = 0 } = {}) {
  const writes = [], messages = [], fetches = []
  const row = { id: 's1', link_id: 'l1', anime_id: '123', chat_id: '42', anime_title: 'Test',
    baseline_episode: 3, notify_new_episodes: true, telegram_episode: cursor }
  const db = { query: async (sql, args) => {
    if (sql.includes('LEFT JOIN')) return { rows: [row, { ...row, id: 's2' }] }
    if (sql.includes('INSERT')) { writes.push(args); return { rows: [] } }
    return { rows: active ? [{ id: 's1' }] : [] }
  } }
  return { writes, messages, fetches, args: { db, siteUrl: 'https://example.com',
    fetchEpisodes: async id => { fetches.push(id); return 4 },
    telegram: async (_, body) => { if (sendFails) throw Error('offline'); messages.push(body) } } }
}
test('one source request per title, writes only after successful delivery', async () => {
  const f = fixture(); await scanEpisodes(f.args)
  assert.equal(f.fetches.length, 1); assert.equal(f.messages.length, 2); assert.equal(f.writes.length, 2)
  assert.match(f.messages[0].text, /episode=4/)
})
test('failed delivery keeps cursor for retry', async () => {
  const f = fixture({ sendFails: true }); await scanEpisodes(f.args); assert.equal(f.writes.length, 0)
})
test('muted/unlinked during scan or already delivered: no delivery', async () => {
  for (const options of [{ active: false }, { cursor: 4 }]) {
    const f = fixture(options); await scanEpisodes(f.args)
    assert.equal(f.messages.length, 0); assert.equal(f.writes.length, 0)
  }
})
test('first sight seeds the cursor instead of a backlog of old episodes', async () => {
  // A subscription linked today: no Telegram cursor yet, baseline is old.
  // The scan must seed the cursor with what already aired and stay silent.
  const f = fixture({ cursor: null }); await scanEpisodes(f.args)
  assert.equal(f.messages.length, 0)
  assert.deepEqual(f.writes, [['s1', 'l1', 4], ['s2', 'l1', 4]])
  // Next scan (cursor seeded): still silent, nothing new aired.
  const g = fixture({ cursor: 4 }); await scanEpisodes(g.args)
  assert.equal(g.messages.length, 0); assert.equal(g.writes.length, 0)
})
