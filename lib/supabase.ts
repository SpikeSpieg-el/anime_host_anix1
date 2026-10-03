import { createClient } from '@supabase/supabase-js'
import { clearPendingAlerts, readPendingAlerts, toAlertRow } from '@/lib/translation-alerts'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if env vars are properly configured (not placeholder values)
const isValidConfig = supabaseUrl && 
  supabaseKey && 
  supabaseUrl.startsWith('http') && 
  supabaseUrl !== 'your-supabase-url' && 
  supabaseKey !== 'your-supabase-anon-key'

// Create a mock client for build process when env vars are missing
const createMockClient = () => {
  const mockClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve(),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null })
        })
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      rpc: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({
        match: () => Promise.resolve({ data: null, error: null }),
        eq: () => Promise.resolve({ data: null, error: null })
      })
    })
  }
  return mockClient as any
}

let supabaseInstance: any = null

try {
  if (isValidConfig) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        lock: async (name, acquireTimeout, fn) => {
          return await fn()
        },
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'anime-host-anix1',
        },
      },
    })
  } else {
    supabaseInstance = createMockClient()
  }
} catch (error) {
  console.error('[Supabase] Client initialization error:', error)
  supabaseInstance = createMockClient()
}

export const supabase = supabaseInstance

// Handle Navigator Lock abort errors that occur asynchronously
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError' && event.reason?.message?.includes('signal is aborted')) {
      console.warn('[Supabase] Navigator Lock abort error caught and ignored')
      event.preventDefault()
    }
  })
  
  // Механизм проверки и восстановления соединения при возврате на вкладку
  let wasHidden = false
  
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && wasHidden) {
      console.log('[Supabase] Tab became visible after being hidden, checking connection...')
      wasHidden = false
      
      try {
        // Проверяем сессию
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Supabase] Session check failed after tab focus:', error)
          // Отправляем событие для переподключения
          window.dispatchEvent(new CustomEvent('supabase-reconnect-needed'))
        } else if (session) {
          console.log('[Supabase] Session valid after tab focus')
          // Отправляем событие для перезагрузки данных
          window.dispatchEvent(new CustomEvent('supabase-reconnected'))
        }
      } catch (err) {
        console.error('[Supabase] Error checking connection:', err)
      }
    } else if (document.visibilityState === 'hidden') {
      wasHidden = true
      console.log('[Supabase] Tab hidden, marking for reconnection check')
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleVisibilityChange)
}

// --- ФУНКЦИЯ ИСПРАВЛЕНИЯ ПЕРЕПОЛНЕНИЯ МОНЕТ ---
// Раньше здесь был upsert баланса прямо из браузера: игрок мог «починить»
// переполнение, подсунув серверу любую сумму. Теперь сумму решает сервер
// (api/coins/normalize), клиент только просит перепроверить баланс.
export async function fixOverflowCoins(userId: string, _targetAmount?: number) {
  if (typeof window === 'undefined') return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('No session found during fix overflow')
      return null
    }

    const res = await fetch('/api/coins/normalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    })
    if (!res.ok) {
      console.error('[fixOverflowCoins] normalize failed:', res.status)
      return null
    }
    const data = await res.json()
    const coins = Number(data.coins)

    // Очищаем localStorage, чтобы не остался старый (возможно, раздутый) кэш
    localStorage.removeItem("gacha-coins")
    window.dispatchEvent(new CustomEvent('coins-updated', { detail: { coins } }))

    console.log(`[fixOverflowCoins] Server balance for ${userId}: ${coins} (clamped: ${Boolean(data.clamped)})`)
    return coins
  } catch (error) {
    console.error('Fix overflow exception:', error)
    return null
  }
}

// --- ФУНКЦИЯ ПРИНУДИТЕЛЬНОЙ СИНХРОНИЗАЦИИ МОНЕТ ---
// Сервер — единственный источник правды по балансу. Клиент больше не может
// «подтолкнуть» баланс вверх значением из localStorage: раньше он брал
// max(local, db) и записывал обратно, что давало способ напечатать монеты.
export async function forceSyncCoins(userId: string) {
  if (typeof window === 'undefined') return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('No session found during force sync')
      return null
    }

    const res = await fetch('/api/coins/normalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    })

    if (!res.ok) {
      console.error('Force sync normalize failed:', res.status)
      return null
    }

    const data = await res.json()
    const coins = Number(data.coins)
    if (!Number.isFinite(coins)) {
      console.error('Force sync: bad balance from server')
      return null
    }

    localStorage.setItem('gacha-coins', coins.toString())
    window.dispatchEvent(new CustomEvent('coins-updated', { detail: { coins } }))
    console.log('Force sync completed, server balance:', coins)
    return coins
  } catch (error) {
    console.error('Force sync exception:', error)
    return null
  }
}

// --- ФУНКЦИЯ СИНХРОНИЗАЦИИ ---
// Берет данные из LocalStorage и отправляет в БД при входе
export async function syncLocalDataToAccount(userId: string) {
  if (typeof window === 'undefined') return

  // 1. Синхронизация закладок
  const rawBookmarks = localStorage.getItem("bookmarks_v1")
  if (rawBookmarks) {
    try {
      const bookmarks = JSON.parse(rawBookmarks)
      if (Array.isArray(bookmarks) && bookmarks.length > 0) {
        const payload = bookmarks.map((b: any) => ({
          user_id: userId,
          anime_id: b.id,
          anime_data: b
        }))

        // Upsert: вставляем новые, игнорируем дубликаты
        const { error } = await supabase
          .from('bookmarks')
          .upsert(payload, { onConflict: 'user_id, anime_id', ignoreDuplicates: true })

        if (!error) {
          localStorage.removeItem("bookmarks_v1")
          document.cookie = `bookmark_ids=; path=/; max-age=0; SameSite=Lax`
          console.log('Bookmarks synced')
        }
      }
    } catch {
      // ignore invalid json
    }
  }

  // 2. Синхронизация истории
  const rawHistory = localStorage.getItem("watch-history")
  if (rawHistory) {
    try {
      const history = JSON.parse(rawHistory)
      if (Array.isArray(history) && history.length > 0) {
        const payload = history.map((h: any) => ({
          user_id: userId,
          anime_id: h.id,
          episode: h.episode,
          episodes_total: h.episodesTotal,
          title: h.title,
          poster: h.poster,
          timestamp: h.timestamp
        }))

        const { error } = await supabase
          .from('watch_history')
          .upsert(payload, { onConflict: 'user_id, anime_id', ignoreDuplicates: true }) // Или update, если хотим перезаписать

        if (!error) {
          localStorage.removeItem("watch-history")
          console.log('History synced')
        }
      }
    } catch {
      // ignore invalid json
    }
  }

  // 2b. Синхронизация ожиданий озвучки (translation_alerts).
  // Гость мог нажать «Уведомить меня» на плашке «Озвучка не найдена» ещё до
  // регистрации. Намерение лежит в localStorage и обязано превратиться в
  // реальное ожидание: иначе обещанное уведомление о появлении озвучки
  // не придёт никогда (закладок и истории у такого тайтла нет).
  try {
    const pendingAlerts = readPendingAlerts()
    if (pendingAlerts.length > 0) {
      const alertsPayload = pendingAlerts.map((intent) => ({
        ...toAlertRow(userId, intent),
        // Повторный вход не должен «хоронить» ожидание, если оно уже
        // закрывалось уведомлением ранее.
        notified_at: null,
        last_checked_at: null,
      }))

      const { error } = await supabase
        .from('translation_alerts')
        .upsert(alertsPayload, { onConflict: 'user_id,anime_id' })

      if (!error) {
        clearPendingAlerts(pendingAlerts.map((intent) => intent.animeId))
        console.log(`Translation alerts synced: ${alertsPayload.length}`)
      } else {
        console.warn('Translation alerts sync failed:', error.message)
      }
    }
  } catch (error) {
    console.warn('Translation alerts sync exception:', error)
  }

  // 3. Синхронизация монет: только читаем баланс с сервера.
  // Раньше здесь был upsert max(localStorage, db) — то есть браузер мог
  // записать в базу любое число. Теперь монеты меняются только на сервере.
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch('/api/coins/normalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        const coins = Number(data.coins)
        if (Number.isFinite(coins)) {
          localStorage.setItem('gacha-coins', coins.toString())
          window.dispatchEvent(new CustomEvent('coins-updated', { detail: { coins } }))
          console.log(`Coins synced from server: ${coins}`)
        }
      }
    }
  } catch (error) {
    console.error("Coins sync exception:", error)
  }

  // 4. Синхронизация карт из гачи
  const rawCollection = localStorage.getItem("gacha-collection")
  if (rawCollection) {
    try {
      const collection = JSON.parse(rawCollection)
      if (Array.isArray(collection) && collection.length > 0) {
        console.log(`Syncing ${collection.length} gacha cards to database...`)
        
        let syncedCount = 0
        for (const card of collection) {
          try {
            // Импортируем функцию для сохранения карт
            const { saveCardToDatabase } = await import('@/app/gacha/client-actions')
            const result = await saveCardToDatabase(card)
            if (result.success) {
              syncedCount++
            }
          } catch (error) {
            console.error('Failed to sync card:', card.uniqueId, error)
          }
        }
        
        console.log(`Synced ${syncedCount}/${collection.length} gacha cards to database`)
      }
    } catch (error) {
      console.error('Error syncing gacha collection:', error)
    }
  }

  // 5. Синхронизация pity данных
  const rawPity = localStorage.getItem("gacha-pity")
  if (rawPity) {
    try {
      const pityData = JSON.parse(rawPity)
      if (pityData && typeof pityData === 'object') {
        console.log('Syncing pity data to database...')
        
        const { error } = await supabase
          .from('user_pity')
          .upsert({ 
            id: userId,
            bad_luck_streak: pityData.bad_luck_streak || 0,
            last_rare_roll: pityData.last_rare_roll || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (!error) {
          console.log('Pity data synced successfully')
        } else {
          console.error('Pity sync error:', error)
        }
      }
    } catch (error) {
      console.error('Error syncing pity data:', error)
    }
  }

  // 6. Очищаем гача-данные, чтобы избежать переноса между пользователями
  try {
    localStorage.removeItem("gacha-collection")
    localStorage.removeItem("gacha-sync-queue")
    localStorage.removeItem("gacha-prioritize-main-characters")
    localStorage.removeItem("gacha-coins")
    localStorage.removeItem("gacha-dust")
    localStorage.removeItem("gacha-pity")
    console.log('Gacha local data cleared to prevent cross-user contamination')
  } catch (error) {
    console.error('Error clearing gacha local data:', error)
  }

  // 7. Синхронизация статистики аккаунта (DB -> localStorage-состояние)
  try {
    const stats = await getAccountStats(userId)
    if (stats && (stats.total_time_ms !== undefined || stats.last_visit_at !== undefined)) {
      console.log('Account stats synced from DB')
      await updateAccountStats(userId, { ...stats })
    } else {
      console.log('No account_stats found for user during sync')
    }
  } catch (error) {
    console.error('Error syncing account stats:', error)
  }
}

// --- Account statistics helpers ---

/** SELECT summary stats row for a user. Returns null if not found / guest. */
export async function getAccountStats(userId: string) {
  try {
    const { data, error } = await supabase
      .from('account_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) return null
    // Преобразуем snake_case в camelCase для совместимости с TypeScript
    if (data) {
      return {
        id: data.id,
        user_id: data.user_id,
        totalSessions: data.total_sessions,
        totalTimeMs: data.total_time_ms,
        watchTimeMs: data.watch_time_ms ?? 0,
        lastVisitAt: data.last_visit_at,
        firstVisitAt: data.first_visit_at,
        pageViews: data.page_views,
        watchEvents: data.watch_events,
        gachaRolls: data.gacha_rolls,
        battlesStarted: data.battles_started,
        bookmarksAdded: data.bookmarks_added,
        marketActions: data.market_actions,
        searches: data.searches,
        avgSessionMs: data.avg_session_ms,
        lastUpdatedAt: data.last_updated_at,
      } as any
    }
    return null
  } catch (e) {
    console.error('[supabase] getAccountStats error:', e)
    return null
  }
}

/** UPSERT a partial patch into account_stats, always refreshing last_updated_at. */
export async function updateAccountStats(userId: string, patch: Record<string, any>): Promise<boolean> {
  try {
    // Преобразуем camelCase в snake_case для БД
    const dbPatch: Record<string, any> = {
      last_updated_at: new Date().toISOString(),
    }
    
    if (patch.totalSessions !== undefined) dbPatch.total_sessions = patch.totalSessions
    if (patch.totalTimeMs !== undefined) dbPatch.total_time_ms = patch.totalTimeMs
    if (patch.watchTimeMs !== undefined) dbPatch.watch_time_ms = patch.watchTimeMs
    if (patch.lastVisitAt !== undefined) dbPatch.last_visit_at = patch.lastVisitAt
    if (patch.firstVisitAt !== undefined) dbPatch.first_visit_at = patch.firstVisitAt
    if (patch.pageViews !== undefined) dbPatch.page_views = patch.pageViews
    if (patch.watchEvents !== undefined) dbPatch.watch_events = patch.watchEvents
    if (patch.gachaRolls !== undefined) dbPatch.gacha_rolls = patch.gachaRolls
    if (patch.battlesStarted !== undefined) dbPatch.battles_started = patch.battlesStarted
    if (patch.bookmarksAdded !== undefined) dbPatch.bookmarks_added = patch.bookmarksAdded
    if (patch.marketActions !== undefined) dbPatch.market_actions = patch.marketActions
    if (patch.searches !== undefined) dbPatch.searches = patch.searches
    if (patch.avgSessionMs !== undefined) dbPatch.avg_session_ms = patch.avgSessionMs
    
    const { error } = await supabase
      .from('account_stats')
      .upsert({ user_id: userId, ...dbPatch }, { onConflict: 'user_id' })
    if (error) {
      console.error('[supabase] updateAccountStats error:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[supabase] updateAccountStats exception:', e)
    return false
  }
}

export type AccountStatsIncrements = {
  totalSessions?: number
  totalTimeMs?: number
  pageViews?: number
  watchEvents?: number
  watchTimeMs?: number
  gachaRolls?: number
  battlesStarted?: number
  bookmarksAdded?: number
  marketActions?: number
  searches?: number
}

/**
 * Atomically increments counters in account_stats when the deployed migration
 * provides the RPC. The fallback keeps older installations usable until the
 * migration is applied.
 */
export async function incrementAccountStats(userId: string, increments: AccountStatsIncrements): Promise<boolean> {
  const values = {
    totalSessions: Math.max(0, Math.round(increments.totalSessions ?? 0)),
    totalTimeMs: Math.max(0, Math.round(increments.totalTimeMs ?? 0)),
    pageViews: Math.max(0, Math.round(increments.pageViews ?? 0)),
    watchEvents: Math.max(0, Math.round(increments.watchEvents ?? 0)),
    watchTimeMs: Math.max(0, Math.round(increments.watchTimeMs ?? 0)),
    gachaRolls: Math.max(0, Math.round(increments.gachaRolls ?? 0)),
    battlesStarted: Math.max(0, Math.round(increments.battlesStarted ?? 0)),
    bookmarksAdded: Math.max(0, Math.round(increments.bookmarksAdded ?? 0)),
    marketActions: Math.max(0, Math.round(increments.marketActions ?? 0)),
    searches: Math.max(0, Math.round(increments.searches ?? 0)),
  }

  if (Object.values(values).every((value) => value === 0)) return true

  try {
    if (typeof supabase.rpc === 'function') {
      const { error } = await supabase.rpc('increment_account_stats', {
        p_user_id: userId,
        p_total_sessions: values.totalSessions,
        p_total_time_ms: values.totalTimeMs,
        p_page_views: values.pageViews,
        p_watch_events: values.watchEvents,
        p_watch_time_ms: values.watchTimeMs,
        p_gacha_rolls: values.gachaRolls,
        p_battles_started: values.battlesStarted,
        p_bookmarks_added: values.bookmarksAdded,
        p_market_actions: values.marketActions,
        p_searches: values.searches,
      })
      if (!error) return true
    }

    // Fallback для старых баз без RPC. Он не так устойчив к параллельным
    // запросам, но не ломает сбор данных во время постепенного обновления БД.
    const current = await getAccountStats(userId)
    const fallbackPatch: Record<string, any> = {
      totalSessions: (current?.totalSessions ?? 0) + values.totalSessions,
      totalTimeMs: (current?.totalTimeMs ?? 0) + values.totalTimeMs,
      pageViews: (current?.pageViews ?? 0) + values.pageViews,
      watchEvents: (current?.watchEvents ?? 0) + values.watchEvents,
      gachaRolls: (current?.gachaRolls ?? 0) + values.gachaRolls,
      battlesStarted: (current?.battlesStarted ?? 0) + values.battlesStarted,
      bookmarksAdded: (current?.bookmarksAdded ?? 0) + values.bookmarksAdded,
      marketActions: (current?.marketActions ?? 0) + values.marketActions,
      searches: (current?.searches ?? 0) + values.searches,
    }
    // Не отправляем новое поле в старую БД, пока миграция ещё не применена.
    if (values.watchTimeMs > 0) {
      fallbackPatch.watchTimeMs = (current?.watchTimeMs ?? 0) + values.watchTimeMs
    }
    return await updateAccountStats(userId, fallbackPatch)
  } catch (e) {
    console.error('[supabase] incrementAccountStats error:', e)
    return false
  }
}

/** INSERT a single activity event row into user_activity_events. */
export async function recordActivityEvent(userId: string, eventType: string, category?: string | null, payload: Record<string, any> = {}) {
  try {
    const { error } = await supabase.from('user_activity_events').insert({
      user_id: userId,
      event_type: eventType,
      category: category ?? undefined,
      payload: payload ?? {}
    })
    if (error) console.error('[supabase] recordActivityEvent error:', error)
  } catch (e) {
    console.error('[supabase] recordActivityEvent exception:', e)
  }
}

/** Batch INSERT of activity events. */
export async function recordActivityEvents(userId: string, events: Array<{ eventType: string; category?: string | null; payload?: Record<string, any> }>) {
  try {
    if (!events || events.length === 0) return
    const rows = events.map((e) => ({
      user_id: userId,
      event_type: e.eventType,
      category: e.category ?? undefined,
      payload: e.payload ?? {}
    }))
    const { error } = await supabase.from('user_activity_events').insert(rows)
    if (error) console.error('[supabase] recordActivityEvents error:', error)
  } catch (e) {
    console.error('[supabase] recordActivityEvents exception:', e)
  }
}