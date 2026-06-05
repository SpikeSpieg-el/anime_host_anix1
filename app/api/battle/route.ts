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
        .single()

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

        if (enemyIds.length > 0) {
          const { data: newDaily } = await supabaseAdmin
            .from('battle_daily')
            .insert({
              date: today,
              enemy_ids: enemyIds,
              coins_reward: 200,
              dust_reward: 50,
              xp_reward: 100,
              energy_cost: 1,
              is_active: true
            })
            .select('*')
            .single()

          dailyBattle = newDaily
        }
      }

      let dailyDungeon = null
      if (dailyBattle && dailyBattle.enemy_ids && dailyBattle.enemy_ids.length > 0) {
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
          enemy_ids: dailyBattle.enemy_ids
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

      // Add daily dungeons to the beginning of the list if available
      const dailyDungeons = []
      if (dailyDungeon) dailyDungeons.push(dailyDungeon)
      if (dailyMarketDungeon) dailyDungeons.push(dailyMarketDungeon)
      
      allDungeons = dailyDungeons.length > 0 ? [...dailyDungeons, ...(dungeons || [])] : (dungeons || [])

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

      const { result, coinsEarned, dustEarned, xpEarned, turns } = body

      if (result !== 'win' && result !== 'loss') {
        return NextResponse.json({
          success: false,
          message: "Неверный результат боя"
        }, { status: 400 })
      }

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
          coins_earned: coinsEarned || 0,
          dust_earned: dustEarned || 0,
          xp_earned: xpEarned || 0,
          battle_turns: turns || 3,
        })

      return NextResponse.json({ success: true })
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
      
      if (dungeonId.startsWith('daily-market-')) {
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
        const { data: dailyBattle } = await supabaseAdmin
          .from('battle_daily')
          .select('*')
          .eq('date', today)
          .eq('is_active', true)
          .single()

        if (!dailyBattle || dailyBattle.enemy_ids.length === 0) {
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
          enemy_ids: dailyBattle.enemy_ids
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
        
        dungeon = regularDungeon
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

      return NextResponse.json({
        success: true,
        staminaUsed: dungeon.energy_cost,
      })
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error('[Battle API POST] Error:', error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
