import { createClient } from '@supabase/supabase-js'

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
// Используется для исправления багов с огромными значениями монет
export async function fixOverflowCoins(userId: string, targetAmount: number = 70000) {
  if (typeof window === 'undefined') return

  try {
    console.log(`[fixOverflowCoins] Fixing coin overflow for user ${userId}, setting to ${targetAmount}`);
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('No session found during fix overflow')
      return null
    }

    const { error } = await supabase
      .from('user_coins')
      .upsert({ 
        id: userId, 
        coins: targetAmount, 
        updated_at: new Date().toISOString() 
      }, {
        onConflict: 'id'
      })

    if (error) {
      console.error('Fix overflow error:', error)
      return null
    }

    // Очищаем localStorage чтобы избежать конфликтов
    localStorage.removeItem("gacha-coins")
    
    console.log(`[fixOverflowCoins] Successfully fixed coins to ${targetAmount}`)
    return targetAmount
  } catch (error) {
    console.error('Fix overflow exception:', error)
    return null
  }
}

// --- ФУНКЦИЯ ПРИНУДИТЕЛЬНОЙ СИНХРОНИЗАЦИИ МОНЕТ ---
// Используется для исправления расхождений между localStorage и БД
export async function forceSyncCoins(userId: string) {
  if (typeof window === 'undefined') return

  try {
    const rawCoins = localStorage.getItem("gacha-coins")
    const localCoins = rawCoins ? parseInt(rawCoins, 10) || 1000 : 0
    
    // Используем клиентский Supabase для аутентифицированных запросов
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('No session found during force sync')
      return null
    }

    const { data: existingData, error } = await supabase
      .from('user_coins')
      .select('coins')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Force sync DB error:', error)
      return null
    }

    if (existingData && existingData.coins !== null) {
      // БЕЗОПАСНАЯ СИНХРОНИЗАЦИЯ: берем максимум из локальных и БД, но не суммируем
      // Это предотвращает дублирование монет
      let finalCoins = existingData.coins; // Начинаем с значения из БД
      
      // Если в localStorage есть монеты и они больше, чем в БД, используем их
      if (localCoins > existingData.coins) {
        finalCoins = localCoins;
        console.log(`Force sync: using higher local amount ${localCoins} > DB ${existingData.coins}`);
      } else {
        console.log(`Force sync: keeping DB amount ${existingData.coins} >= local ${localCoins}`);
      }
      
      // Защита от нереалистично больших значений (больше 10 миллионов)
      if (finalCoins > 10000000) {
        console.warn(`Force sync: detected unrealistic amount ${finalCoins}, capping to 1M`);
        finalCoins = 1000000;
      }
      
      const { error: updateError } = await supabase
        .from('user_coins')
        .upsert({ id: userId, coins: finalCoins, updated_at: new Date().toISOString() }, {
          onConflict: 'id'
        })

      if (updateError) {
        console.error('Force sync update error:', updateError)
        return null
      }

      if (!updateError) {
        localStorage.removeItem("gacha-coins")
        console.log('Force sync completed successfully, final amount:', finalCoins)
        return finalCoins
      }
    } else {
      console.log('No existing coins record found during force sync')
      return null
    }
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

  // 3. Синхронизация монет из гачи
  const rawCoins = localStorage.getItem("gacha-coins")
  if (rawCoins) {
    try {
      const localCoins = parseInt(rawCoins, 10) || 1000
      const { data: existingData } = await supabase
        .from('user_coins')
        .select('coins')
        .eq('id', userId)
        .single()

      let finalCoins = localCoins
      if (existingData && existingData.coins !== null) {
        // БЕЗОПАСНАЯ СИНХРОНИЗАЦИЯ: берем максимум, но не суммируем
        finalCoins = Math.max(localCoins, existingData.coins)
        console.log(`Coins sync: local=${localCoins}, db=${existingData.coins}, using max=${finalCoins}`)
        
        // Защита от нереалистично больших значений
        if (finalCoins > 10000000) {
          console.warn(`Coins sync: detected unrealistic amount ${finalCoins}, capping to 1M`);
          finalCoins = 1000000;
        }
      } else {
        // Если записи нет, даём бонус 10000 монет (1000 база + 9000 бонус)
        // ПЛЮС локальные монеты, если они больше 1000
        finalCoins = Math.max(10000, localCoins)
        console.log(`Coins sync: no DB record, using max(10000, ${localCoins}) = ${finalCoins}`)
      }

      const { error } = await supabase
        .from('user_coins')
        .upsert({ id: userId, coins: finalCoins, updated_at: new Date().toISOString() }, {
          onConflict: 'id'
        })

      if (!error) {
        localStorage.removeItem("gacha-coins")
        console.log('Coins synced successfully, final amount:', finalCoins)
      } else {
        console.error('Coins sync error:', error)
      }
    } catch (error) {
      console.error('Coins sync exception:', error)
    }
  }

  // 4. Очищаем гача-данные, чтобы избежать переноса между пользователями
  try {
    localStorage.removeItem("gacha-collection")
    localStorage.removeItem("gacha-sync-queue")
    localStorage.removeItem("gacha-prioritize-main-characters")
    localStorage.removeItem("gacha-coins")
    localStorage.removeItem("gacha-dust")
    console.log('Gacha local data cleared to prevent cross-user contamination')
  } catch (error) {
    console.error('Error clearing gacha local data:', error)
  }

  // 5. Синхронизация статистики аккаунта (DB -> localStorage-состояние)
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
export async function updateAccountStats(userId: string, patch: Record<string, any>) {
  try {
    // Преобразуем camelCase в snake_case для БД
    const dbPatch: Record<string, any> = {
      last_updated_at: new Date().toISOString(),
    }
    
    if (patch.totalSessions !== undefined) dbPatch.total_sessions = patch.totalSessions
    if (patch.totalTimeMs !== undefined) dbPatch.total_time_ms = patch.totalTimeMs
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
    if (error) console.error('[supabase] updateAccountStats error:', error)
  } catch (e) {
    console.error('[supabase] updateAccountStats exception:', e)
  }
}

/** INSERT a single activity event row into user_activity_events. */
export async function recordActivityEvent(userId: string, eventType: string, category?: string | null, payload: Record<string, any> = {}) {
  try {
    const { error } = await supabase.from('user_activity_events').insert({
      user_id: userId,
      event_type: eventType,
      category: category ?? undefined,
      payload: JSON.stringify(payload)
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
      payload: JSON.stringify(e.payload ?? {})
    }))
    const { error } = await supabase.from('user_activity_events').insert(rows)
    if (error) console.error('[supabase] recordActivityEvents error:', error)
  } catch (e) {
    console.error('[supabase] recordActivityEvents exception:', e)
  }
}