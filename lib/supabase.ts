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

export const supabase = isValidConfig
  ? createClient(supabaseUrl, supabaseKey)
  : createMockClient()

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
      const coins = parseInt(rawCoins, 10) || 1000
      const { data: existingData } = await supabase
        .from('user_coins')
        .select('coins')
        .eq('id', userId)
        .single()

      let finalCoins = coins
      if (existingData && existingData.coins !== null) {
        // Если в БД есть запись, берём максимальное значение
        finalCoins = Math.max(coins, existingData.coins)
      } else {
        // Если записи нет, даём бонус 10000 монет (1000 база + 9000 бонус)
        finalCoins = 10000
      }

      const { error } = await supabase
        .from('user_coins')
        .upsert({ id: userId, coins: finalCoins, updated_at: new Date().toISOString() }, {
          onConflict: 'id'
        })

      if (!error) {
        localStorage.removeItem("gacha-coins")
        console.log('Coins synced')
      }
    } catch {
      // ignore invalid json
    }
  }
}