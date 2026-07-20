// app/api/battle/route.ts - PVE Battle API
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  calculateTeamPower,
  calculateStaminaRefill,
  calculateLevelUp,
  type BattleCard,
  type BattleEnemy,
} from '@/lib/battle-engine'
import { getAdaptiveAIProfile } from '@/app/battle/ai/difficulty'

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey || supabaseAnonKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
  if (error || !user) return null

  return { user, supabaseAdmin }
}

// GET - Fetch battle state (progress, dungeons, enemies)
export async function GET(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'all'

    if (mode === 'progress' || mode === 'all') {
      // Get or create user progress
      let { data: progress, error } = await supabaseAdmin
        .from('user_battle_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error || !progress) {
        const { data: newProgress, error: insertError } = await supabaseAdmin
          .from('user_battle_progress')
          .insert({ user_id: user.id })
          .select('*')
          .single()
        if (insertError) throw insertError
        progress = newProgress
      }

      // Refill stamina
      const staminaInfo = calculateStaminaRefill(
        progress.last_stamina_refill,
        progress.current_stamina,
        progress.max_stamina
      )

      if (staminaInfo.canRefill) {
        await supabaseAdmin
          .from('user_battle_progress')
          .update({
            current_stamina: staminaInfo.stamina,
            last_stamina_refill: new Date().toISOString(),
          })
          .eq('user_id', user.id)
        progress.current_stamina = staminaInfo.stamina
      }

      // Reset daily counter if needed
      const today = new Date().toISOString().split('T')[0]
      if (progress.last_daily_reset !== today) {
        await supabaseAdmin
          .from('user_battle_progress')
          .update({
            daily_battles_today: 0,
            last_daily_reset: today,
          })
          .eq('user_id', user.id)
        progress.daily_battles_today = 0
      }

      if (mode === 'progress') {
        return NextResponse.json({
          success: true,
          progress: {
            ...progress,
            staminaRefillMs: staminaInfo.nextRefillMs,
          },
        })
      }
    }

    if (mode === 'dungeons' || mode === 'all') {
      const { data: dungeons } = await supabaseAdmin
        .from('battle_dungeons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      // For each dungeon, fetch its enemies
      // Since enemy_ids is a UUID array, we need to fetch enemies separately
      const { data: allEnemies } = await supabaseAdmin
        .from('battle_enemies')
        .select('*')
        .eq('is_active', true)

      if (mode === 'dungeons') {
        return NextResponse.json({
          success: true,
          dungeons: dungeons || [],
          enemies: allEnemies || [],
        })
      }
    }

    if (mode === 'logs' || mode === 'all') {
      const limit = parseInt(searchParams.get('limit') || '20')
      const { data: logs } = await supabaseAdmin
        .from('battle_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (mode === 'logs') {
        return NextResponse.json({ success: true, logs: logs || [] })
      }
    }

    if (mode === 'all') {
      // Reuse the data fetched above instead of duplicating the logic
      let progress = null
      let staminaInfo = { stamina: 10, nextRefillMs: 0, canRefill: false }
      let allDungeons = []
      let allEnemies = []
      
      // Get progress
      let { data: progressData, error } = await supabaseAdmin
        .from('user_battle_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error || !progressData) {
        const { data: newProgress, error: insertError } = await supabaseAdmin
          .from('user_battle_progress')
          .insert({ user_id: user.id })
          .select('*')
          .single()
        if (insertError) throw insertError
        progressData = newProgress
      }

      if (progressData) {
        progress = progressData
        staminaInfo = calculateStaminaRefill(
          progressData.last_stamina_refill,
          progressData.current_stamina,
          progressData.max_stamina
        )

        // Refill stamina if needed
        if (staminaInfo.canRefill) {
          await supabaseAdmin
            .from('user_battle_progress')
            .update({
              current_stamina: staminaInfo.stamina,
              last_stamina_refill: new Date().toISOString(),
            })
            .eq('user_id', user.id)
          progressData.current_stamina = staminaInfo.stamina
        }

        // Reset daily counter if needed
        const today = new Date().toISOString().split('T')[0]
        if (progressData.last_daily_reset !== today) {
          await supabaseAdmin
            .from('user_battle_progress')
            .update({
              daily_battles_today: 0,
              last_daily_reset: today,
            })
            .eq('user_id', user.id)
          progressData.daily_battles_today = 0
        }
      }

      // Get dungeons and enemies
      const { data: dungeons } = await supabaseAdmin
        .from('battle_dungeons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      const { data: enemies } = await supabaseAdmin
        .from('battle_enemies')
        .select('*')
        .eq('is_active', true)

      allEnemies = enemies || []

      // Get today's daily battle
      const today = new Date().toISOString().split('T')[0]
      let { data: dailyBattle } = await supabaseAdmin
        .from('battle_daily')
        .select('*')
        .eq('date', today)
        .eq('is_active', true)
        .maybeSingle()

      // Auto-create daily battle if it doesn't exist
      if (!dailyBattle) {
        // Get random elite enemies for today's daily
        const { data: eliteEnemies } = await supabaseAdmin
          .from('battle_enemies')
          .select('id')
          .eq('tier', 'elite')
          .eq('is_active', true)
          .limit(2)

        const enemyIds = eliteEnemies ? eliteEnemies.map((e: any) => e.id) : []

        // Use upsert to handle race condition (unique constraint on date)
        const { data: upsertedDaily, error: upsertError } = await supabaseAdmin
          .from('battle_daily')
          .upsert({
            date: today,
            enemy_ids: enemyIds.length > 0 ? enemyIds : [],
            coins_reward: 200,
            dust_reward: 50,
            xp_reward: 100,
            energy_cost: 1,
            is_active: true
          }, { onConflict: 'date' })
          .select('*')
          .maybeSingle()

        if (upsertError) {
          // If upsert failed, try to read the existing row
          const { data: existingDaily } = await supabaseAdmin
            .from('battle_daily')
            .select('*')
            .eq('date', today)
            .maybeSingle()
          dailyBattle = existingDaily
        } else {
          dailyBattle = upsertedDaily
        }
      }

      let dailyDungeon = null
      // Always create daily dungeon if dailyBattle exists (CCG system uses AI decks, not enemy_ids)
      if (dailyBattle) {
        // Create a virtual daily dungeon from today's configuration
        dailyDungeon = {
          id: 'daily-' + today,
          name: 'Daily Battle',
          name_ru: 'Ежедневный Бой',
          description: 'Особый ежедневный бой с повышенными наградами! Доступен раз в день.',
          theme: 'daily',
          difficulty: 5,
          required_level: 1,
          energy_cost: dailyBattle.energy_cost,
          coins_reward_base: dailyBattle.coins_reward,
          dust_reward_base: dailyBattle.dust_reward,
          xp_reward_base: dailyBattle.xp_reward,
          image_url: null,
          is_daily: true,
          enemy_ids: dailyBattle.enemy_ids || []
        }
      }

      // Create second daily dungeon with random market deck
      const dailyMarketDungeon = {
        id: 'daily-market-' + today,
        name: 'Daily Market',
        name_ru: 'Рыночный Бой',
        description: 'Бой со случайной сильной колодой из рынка! Уникальные награды.',
        theme: 'daily_market',
        difficulty: 6,
        required_level: 5,
        energy_cost: 2,
        coins_reward_base: 300,
        dust_reward_base: 80,
        xp_reward_base: 150,
        image_url: null,
        is_daily: true,
        enemy_ids: []
      }

      // Add beginner dungeons at the very beginning
      const beginnerDungeons = [
        {
          id: 'tutorial_forest',
          name: 'Tutorial Forest',
          name_ru: 'Учебный Лес',
          description: 'Самая легкая локация для новичков! Идеально для изучения механик боя.',
          theme: 'tutorial_forest',
          difficulty: 1,
          required_level: 1,
          energy_cost: 1,
          coins_reward_base: 50,
          dust_reward_base: 10,
          xp_reward_base: 30,
          image_url: null,
          is_daily: false,
          enemy_ids: []
        },
        {
          id: 'peaceful_meadow',
          name: 'Peaceful Meadow',
          name_ru: 'Спокойная Поляна',
          description: 'Легкая локация для тренировки. Враги используют простые колоды.',
          theme: 'peaceful_meadow',
          difficulty: 2,
          required_level: 1,
          energy_cost: 1,
          coins_reward_base: 75,
          dust_reward_base: 20,
          xp_reward_base: 50,
          image_url: null,
          is_daily: false,
          enemy_ids: []
        }
      ]

      // Add daily dungeons after beginner dungeons
      const dailyDungeons = []
      if (dailyDungeon) dailyDungeons.push(dailyDungeon)
      if (dailyMarketDungeon) dailyDungeons.push(dailyMarketDungeon)

      // Filter out dark_forest from regular dungeons (it will be re-added later with higher level requirement)
      const regularDungeons = (dungeons || []).filter((d: any) => d.theme !== 'dark_forest')

      // Override level requirements for progression
      const levelRequirements: Record<string, number> = {
        'volcano': 7,
        'ocean': 10,
        'sky_castle': 13,
        'demon_realm': 16,
        'tournament': 20
      }

      // Apply level requirements to regular dungeons
      const regularDungeonsWithLevels = regularDungeons.map((d: any) => ({
        ...d,
        required_level: levelRequirements[d.theme] || d.required_level
      }))

      // Add dark_forest as a mid-tier dungeon (level 6 required)
      const darkForestDungeon = {
        id: 'dark_forest',
        name: 'Dark Forest',
        name_ru: 'Тёмный Лес',
        description: 'Средняя сложность. Враги используют сбалансированные колоды.',
        theme: 'dark_forest',
        difficulty: 3,
        required_level: 6,
        energy_cost: 2,
        coins_reward_base: 100,
        dust_reward_base: 30,
        xp_reward_base: 80,
        image_url: null,
        is_daily: false,
        enemy_ids: []
      }

      allDungeons = [...beginnerDungeons, ...dailyDungeons, darkForestDungeon, ...regularDungeonsWithLevels]

      // Get logs
      const { data: logs } = await supabaseAdmin
        .from('battle_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({
        success: true,
        progress: progress ? { ...progress, staminaRefillMs: staminaInfo.nextRefillMs } : null,
        dungeons: allDungeons,
        enemies: allEnemies,
        logs: logs || [],
      })
    }

    return NextResponse.json({ success: false, message: "Invalid mode" }, { status: 400 })
  } catch (error: any) {
    console.error('[Battle API GET] Error:', error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

// POST - Execute a battle
export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const {
      action,
      dungeonId,
      playerCardIds, // array of unique_id strings from user_cards
      playerCards,   // full card data (stats, etc.) for server-side validation
    } = body

    // ==========================================
    // ACTION: get_team_power
    // ==========================================
    if (action === 'get_team_power') {
      if (!playerCards || playerCards.length === 0) {
        return NextResponse.json({
          success: true,
          teamPower: { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }
        })
      }

      const battleCards: BattleCard[] = playerCards.map((c: any) => ({
        uniqueId: c.uniqueId || c.unique_id,
        name: c.name,
        anime: c.anime,
        rarity: c.rarity,
        imageUrl: c.imageUrl || c.image_url,
        stats: c.stats || {
          hp: c.stats_hp || 0,
          atk: c.stats_atk || 0,
          def: c.stats_def || 0,
          spd: c.stats_spd || 0,
          luck: c.stats_luck || 0,
        },
        isMainCharacter: c.isMainCharacter || c.is_main_character || false,
      }))

      const teamPower = calculateTeamPower(battleCards)
      return NextResponse.json({ success: true, teamPower })
    }

    // ==========================================
    // ACTION: finish_battle
    // ==========================================
    if (action === 'finish_battle') {
      if (!dungeonId) {
        return NextResponse.json({
          success: false,
          message: "Отсутствует ID подземелья"
        }, { status: 400 })
      }

      const { result, battleToken, turns } = body

      if (result !== 'win' && result !== 'loss') {
        return NextResponse.json({
          success: false,
          message: "Неверный результат боя"
        }, { status: 400 })
      }

      // Validate battle session token (anti-replay protection)
      let sessionValid = false
      if (battleToken) {
        const { data: session } = await supabaseAdmin
          .from('battle_sessions')
          .select('id, status, dungeon_id, created_at')
          .eq('token', battleToken)
          .eq('user_id', user.id)
          .single()

        if (session && session.status === 'active' && session.dungeon_id === dungeonId) {
          // Check session hasn't expired (30 min timeout)
          const sessionAge = Date.now() - new Date(session.created_at).getTime()
          if (sessionAge < 30 * 60 * 1000) {
            sessionValid = true
            // Mark session as completed
            await supabaseAdmin
              .from('battle_sessions')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', session.id)
          }
        }
      }

      // If token was provided but invalid, reject (anti-replay)
      if (!sessionValid && battleToken) {
        return NextResponse.json({
          success: false,
          message: "Недействительная или истёкшая сессия боя. Начните новый бой."
        }, { status: 403 })
      }
      // No token provided (table missing or insert failed) - allow (backward compat)

      // Get user progress
      let { data: progress } = await supabaseAdmin
        .from('user_battle_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!progress) {
        const { data: newProgress } = await supabaseAdmin
          .from('user_battle_progress')
          .insert({ user_id: user.id })
          .select('*')
          .single()
        progress = newProgress
      }

      // SERVER-SIDE reward calculation based on dungeon config
      let baseCoins = 50
      let baseDust = 10
      let baseXp = 25
      let energyCost = 1

      if (dungeonId === 'tutorial_forest') {
        baseCoins = 50; baseDust = 10; baseXp = 30; energyCost = 1
      } else if (dungeonId === 'peaceful_meadow') {
        baseCoins = 75; baseDust = 20; baseXp = 50; energyCost = 1
      } else if (dungeonId === 'dark_forest') {
        baseCoins = 100; baseDust = 30; baseXp = 80; energyCost = 2
      } else if (dungeonId.startsWith('daily-market-')) {
        baseCoins = 300; baseDust = 80; baseXp = 150; energyCost = 2
      } else if (dungeonId.startsWith('daily-')) {
        energyCost = 1
        const today = new Date().toISOString().split('T')[0]
        const { data: dailyBattle } = await supabaseAdmin
          .from('battle_daily')
          .select('coins_reward, dust_reward, xp_reward, energy_cost')
          .eq('date', today)
          .eq('is_active', true)
          .single()
        if (dailyBattle) {
          baseCoins = dailyBattle.coins_reward || 200
          baseDust = dailyBattle.dust_reward || 50
          baseXp = dailyBattle.xp_reward || 100
          energyCost = dailyBattle.energy_cost || 1
        }
      } else {
        const { data: dungeonData } = await supabaseAdmin
          .from('battle_dungeons')
          .select('coins_reward_base, dust_reward_base, xp_reward_base, energy_cost')
          .eq('id', dungeonId)
          .single()
        if (dungeonData) {
          baseCoins = dungeonData.coins_reward_base || 50
          baseDust = dungeonData.dust_reward_base || 10
          baseXp = dungeonData.xp_reward_base || 25
          energyCost = dungeonData.energy_cost || 1
        }
      }

      // Server-side random multipliers (same formula as client had)
      const coinsEarned = result === 'win' ? Math.round(baseCoins * (1 + Math.random() * 0.3)) : 0
      const dustEarned = result === 'win' ? Math.round(baseDust * (1 + Math.random() * 0.2)) : 0
      const xpEarned = result === 'win' ? Math.round(baseXp * (1 + Math.random() * 0.1)) : Math.round(baseXp * 0.2)

      // Apply rewards for wins
      if (result === 'win') {
        // Update daily counter for daily battles
        if (dungeonId.startsWith('daily-')) {
          await supabaseAdmin
            .from('user_battle_progress')
            .update({
              daily_battles_today: progress.daily_battles_today + 1,
            })
            .eq('user_id', user.id)
        }

        // Add coins
        if (coinsEarned > 0) {
          try {
            await supabaseAdmin.rpc('add_coins_secure', {
              p_user_id: user.id,
              p_amount: coinsEarned,
            })
          } catch {
            // Fallback: increment coins directly
            const { data: currentCoins } = await supabaseAdmin
              .from('user_coins')
              .select('coins')
              .eq('id', user.id)
              .single()
            if (currentCoins) {
              await supabaseAdmin
                .from('user_coins')
                .update({ coins: currentCoins.coins + coinsEarned, updated_at: new Date().toISOString() })
                .eq('id', user.id)
            }
          }
        }

        // Add dust
        if (dustEarned > 0) {
          try {
            await supabaseAdmin.rpc('add_dust_secure', {
              p_user_id: user.id,
              p_amount: dustEarned,
            })
          } catch {
            // Fallback: increment dust directly
            const { data: currentDust } = await supabaseAdmin
              .from('user_dust')
              .select('dust')
              .eq('id', user.id)
              .single()
            if (currentDust) {
              await supabaseAdmin
                .from('user_dust')
                .update({ dust: currentDust.dust + dustEarned, updated_at: new Date().toISOString() })
                .eq('id', user.id)
            }
          }
        }

        // Add XP and handle level up
        if (xpEarned > 0) {
          const { data: updatedProgress } = await supabaseAdmin
            .from('user_battle_progress')
            .select('xp, xp_to_next, level')
            .eq('user_id', user.id)
            .single()

          if (updatedProgress) {
            const newXp = updatedProgress.xp + xpEarned
            const levelUp = calculateLevelUp(newXp, updatedProgress.xp_to_next, updatedProgress.level)

            if (levelUp.leveledUp) {
              await supabaseAdmin
                .from('user_battle_progress')
                .update({
                  xp: levelUp.newXp,
                  xp_to_next: levelUp.newXpToNext,
                  level: levelUp.newLevel,
                  max_stamina: levelUp.newMaxStamina,
                  current_stamina: Math.min(
                    levelUp.newMaxStamina,
                    progress.current_stamina + 2 // Bonus stamina on level up
                  ),
                })
                .eq('user_id', user.id)
            } else {
              await supabaseAdmin
                .from('user_battle_progress')
                .update({ xp: newXp })
                .eq('user_id', user.id)
            }
          }
        }
      }

      // Save battle log
      await supabaseAdmin
        .from('battle_logs')
        .insert({
          user_id: user.id,
          dungeon_id: dungeonId,
          result: result,
          coins_earned: coinsEarned,
          dust_earned: dustEarned,
          xp_earned: xpEarned,
          battle_turns: turns || 3,
          energy_cost: energyCost,
        })

      const { error: learningError } = await supabaseAdmin.rpc('record_ai_battle_learning', {
        p_user_id: user.id,
        p_dungeon_id: dungeonId,
        p_result: result,
        p_turns: Math.max(0, Math.min(Number(turns) || 3, 20)),
      })
      if (learningError) console.error('[Battle API] Failed to record AI learning:', learningError)

      return NextResponse.json({ 
        success: true,
        coinsEarned,
        dustEarned,
        xpEarned,
      })
    }

    // ==========================================
    // ACTION: start_battle (CCG mode - stamina deduction only)
    // ==========================================
    if (action === 'start_battle') {
      if (!dungeonId) {
        return NextResponse.json({
          success: false,
          message: "Выберите подземелье"
        }, { status: 400 })
      }

      // Check stamina
      let { data: progress } = await supabaseAdmin
        .from('user_battle_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!progress) {
        const { data: newProgress } = await supabaseAdmin
          .from('user_battle_progress')
          .insert({ user_id: user.id })
          .select('*')
          .single()
        progress = newProgress
      }

      // Refill stamina
      const staminaInfo = calculateStaminaRefill(
        progress.last_stamina_refill,
        progress.current_stamina,
        progress.max_stamina
      )
      if (staminaInfo.canRefill) {
        progress.current_stamina = staminaInfo.stamina
        await supabaseAdmin
          .from('user_battle_progress')
          .update({ current_stamina: staminaInfo.stamina, last_stamina_refill: new Date().toISOString() })
          .eq('user_id', user.id)
      }

      // Get dungeon info
      let dungeon = null

      // Handle beginner dungeons (virtual, not in database)
      if (dungeonId === 'tutorial_forest') {
        dungeon = {
          id: 'tutorial_forest',
          name: 'Tutorial Forest',
          name_ru: 'Учебный Лес',
          description: 'Самая легкая локация для новичков! Идеально для изучения механик боя.',
          theme: 'tutorial_forest',
          difficulty: 1,
          required_level: 1,
          energy_cost: 1,
          coins_reward_base: 50,
          dust_reward_base: 10,
          xp_reward_base: 30,
          image_url: null,
          is_daily: false,
          enemy_ids: []
        }
      } else if (dungeonId === 'peaceful_meadow') {
        dungeon = {
          id: 'peaceful_meadow',
          name: 'Peaceful Meadow',
          name_ru: 'Спокойная Поляна',
          description: 'Легкая локация для тренировки. Враги используют простые колоды.',
          theme: 'peaceful_meadow',
          difficulty: 2,
          required_level: 1,
          energy_cost: 1,
          coins_reward_base: 75,
          dust_reward_base: 20,
          xp_reward_base: 50,
          image_url: null,
          is_daily: false,
          enemy_ids: []
        }
      } else if (dungeonId === 'dark_forest') {
        dungeon = {
          id: 'dark_forest',
          name: 'Dark Forest',
          name_ru: 'Тёмный Лес',
          description: 'Средняя сложность. Враги используют сбалансированные колоды.',
          theme: 'dark_forest',
          difficulty: 3,
          required_level: 6,
          energy_cost: 2,
          coins_reward_base: 100,
          dust_reward_base: 30,
          xp_reward_base: 80,
          image_url: null,
          is_daily: false,
          enemy_ids: []
        }
      } else if (dungeonId.startsWith('daily-market-')) {
        // Daily market battle with random deck
        const today = new Date().toISOString().split('T')[0]
        dungeon = {
          id: 'daily-market-' + today,
          name: 'Daily Market',
          name_ru: 'Рыночный Бой',
          description: 'Бой со случайной сильной колодой из рынка! Уникальные награды.',
          theme: 'daily_market',
          difficulty: 6,
          required_level: 5,
          energy_cost: 2,
          coins_reward_base: 300,
          dust_reward_base: 80,
          xp_reward_base: 150,
          image_url: null,
          is_daily: true,
          enemy_ids: []
        }
      } else if (dungeonId.startsWith('daily-')) {
        const today = new Date().toISOString().split('T')[0]
        let { data: dailyBattle } = await supabaseAdmin
          .from('battle_daily')
          .select('*')
          .eq('date', today)
          .eq('is_active', true)
          .maybeSingle()

        // Auto-create daily battle if it doesn't exist
        if (!dailyBattle) {
          const { data: upsertedDaily } = await supabaseAdmin
            .from('battle_daily')
            .upsert({
              date: today,
              enemy_ids: [],
              coins_reward: 200,
              dust_reward: 50,
              xp_reward: 100,
              energy_cost: 1,
              is_active: true
            }, { onConflict: 'date' })
            .select('*')
            .maybeSingle()
          dailyBattle = upsertedDaily
        }

        if (!dailyBattle) {
          return NextResponse.json({ success: false, message: "Ежедневный бой не найден" }, { status: 404 })
        }

        dungeon = {
          id: 'daily-' + today,
          name: 'Daily Battle',
          name_ru: 'Ежедневный Бой',
          description: 'Особый ежедневный бой с повышенными наградами! Доступен раз в день.',
          theme: 'daily',
          difficulty: 5,
          required_level: 1,
          energy_cost: dailyBattle.energy_cost,
          coins_reward_base: dailyBattle.coins_reward,
          dust_reward_base: dailyBattle.dust_reward,
          xp_reward_base: dailyBattle.xp_reward,
          image_url: null,
          is_daily: true,
          enemy_ids: dailyBattle.enemy_ids || []
        }
      } else {
        const { data: regularDungeon } = await supabaseAdmin
          .from('battle_dungeons')
          .select('*')
          .eq('id', dungeonId)
          .single()

        if (!regularDungeon) {
          return NextResponse.json({ success: false, message: "Подземелье не найдено" }, { status: 404 })
        }

        // Override level requirements for progression
        const levelRequirements: Record<string, number> = {
          'volcano': 7,
          'ocean': 10,
          'sky_castle': 13,
          'demon_realm': 16,
          'tournament': 20
        }

        dungeon = {
          ...regularDungeon,
          required_level: levelRequirements[regularDungeon.theme] || regularDungeon.required_level
        }
      }

      // Check stamina
      if (progress.current_stamina < dungeon.energy_cost) {
        return NextResponse.json({
          success: false,
          message: `Недостаточно выносливости! Нужно: ${dungeon.energy_cost}, есть: ${progress.current_stamina}`
        }, { status: 400 })
      }

      // Check daily battle limit
      if (dungeonId.startsWith('daily-')) {
        const today = new Date().toISOString().split('T')[0]
        
        if (progress.last_daily_reset !== today) {
          // Reset daily counter in database
          await supabaseAdmin
            .from('user_battle_progress')
            .update({
              daily_battles_today: 0,
              last_daily_reset: today,
            })
            .eq('user_id', user.id)
          progress.daily_battles_today = 0
          progress.last_daily_reset = today
        }

        // Allow 2 daily battles per day (regular + market)
        if (progress.daily_battles_today >= 2) {
          return NextResponse.json({
            success: false,
            message: "Все ежедневные бои уже пройдены! Следующие будут доступны завтра."
          }, { status: 400 })
        }
      }

      // Deduct stamina
      await supabaseAdmin
        .from('user_battle_progress')
        .update({
          current_stamina: progress.current_stamina - dungeon.energy_cost,
          total_battles: progress.total_battles + 1,
        })
        .eq('user_id', user.id)

      // Generate battle session token for anti-replay protection
      let battleToken: string | null = null
      try {
        battleToken = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        await supabaseAdmin
          .from('battle_sessions')
          .insert({
            user_id: user.id,
            dungeon_id: dungeonId,
            token: battleToken,
            status: 'active',
          })
      } catch (e) {
        console.warn('[Battle API] Failed to create battle session:', e)
        battleToken = null
      }

      const [{ data: playerLearning, error: playerLearningError }, { data: globalLearning, error: globalLearningError }] = await Promise.all([
        supabaseAdmin
          .from('ai_player_dungeon_profiles')
          .select('battles, wins, losses, consecutive_wins')
          .eq('user_id', user.id)
          .eq('dungeon_id', dungeonId)
          .maybeSingle(),
        supabaseAdmin
          .from('ai_dungeon_learning')
          .select('battles, wins, losses')
          .eq('dungeon_id', dungeonId)
          .maybeSingle(),
      ])
      if (playerLearningError || globalLearningError) {
        console.error('[Battle API] Failed to load AI learning profile:', playerLearningError || globalLearningError)
      }

      const aiConfig = getAdaptiveAIProfile({
        playerLevel: progress.level,
        dungeonDifficulty: dungeon.difficulty,
        player: playerLearning,
        global: globalLearning,
      })

      return NextResponse.json({
        success: true,
        staminaUsed: dungeon.energy_cost,
        battleToken,
        aiConfig,
      })
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error('[Battle API POST] Error:', error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
