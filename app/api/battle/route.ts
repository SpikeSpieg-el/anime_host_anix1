// app/api/battle/route.ts - PVE Battle API
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  executeBattle,
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
      const { data: dailyBattle } = await supabaseAdmin
        .from('battle_daily')
        .select('*')
        .eq('date', today)
        .eq('is_active', true)
        .single()

      let dailyDungeon = null
      if (dailyBattle && dailyBattle.enemy_ids.length > 0) {
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

      // Add daily dungeon to the beginning of the list if available
      allDungeons = dailyDungeon ? [dailyDungeon, ...(dungeons || [])] : (dungeons || [])

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
    // ACTION: start_battle
    // ==========================================
    if (action === 'start_battle') {
      if (!playerCards || playerCards.length < 1 || playerCards.length > 3) {
        return NextResponse.json({
          success: false,
          message: "Выберите от 1 до 3 карт для боя"
        }, { status: 400 })
      }

      if (!dungeonId) {
        return NextResponse.json({
          success: false,
          message: "Выберите подземелье"
        }, { status: 400 })
      }

      // 1. Validate user owns these cards
      const cardUniqueIds = playerCards.map((c: any) => c.uniqueId || c.unique_id)

      const { data: ownedCards, error: cardsError } = await supabaseAdmin
        .from('user_cards')
        .select('unique_id, user_id')
        .in('unique_id', cardUniqueIds)

      if (cardsError) {
        console.error('[Battle] Cards validation error:', cardsError)
        return NextResponse.json({ success: false, message: "Ошибка проверки карт" }, { status: 500 })
      }

      // Verify all cards belong to this user
      const ownedIds = new Set((ownedCards || []).map(c => c.unique_id))
      for (const id of cardUniqueIds) {
        if (!ownedIds.has(id)) {
          return NextResponse.json({ success: false, message: "Карта не найдена в коллекции" }, { status: 403 })
        }
      }

      // 2. Check stamina
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
      
      if (dungeonId.startsWith('daily-')) {
        // Special handling for daily battles - get today's daily configuration
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

        // Create virtual dungeon object
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
        // Regular dungeon - fetch from database
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
        
        // Reset daily counter if needed
        if (progress.last_daily_reset !== today) {
          progress.daily_battles_today = 0
        }

        // Check if user actually completed today's daily battle
        const { data: todayBattleLog } = await supabaseAdmin
          .from('battle_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('dungeon_id', 'daily-' + today)
          .eq('result', 'win')
          .single()

        if (todayBattleLog || progress.daily_battles_today >= 1) {
          return NextResponse.json({
            success: false,
            message: "Ежедневный бой уже пройден! Следующий будет доступен завтра."
          }, { status: 400 })
        }
      }

      // 3. Get enemies for this dungeon
      // First try dungeon's enemy_ids, if empty pick enemies by difficulty
      let enemies: BattleEnemy[] = []

      if (dungeon.enemy_ids && dungeon.enemy_ids.length > 0) {
        const { data: dungeonEnemies } = await supabaseAdmin
          .from('battle_enemies')
          .select('*')
          .in('id', dungeon.enemy_ids)
          .eq('is_active', true)

        if (dungeonEnemies) {
          enemies = dungeonEnemies.map((e: any) => ({
            id: e.id,
            name: e.name,
            nameRu: e.name_ru,
            anime: e.anime,
            imageUrl: e.image_url,
            level: e.level,
            tier: e.tier,
            stats: {
              hp: e.stats_hp,
              atk: e.stats_atk,
              def: e.stats_def,
              spd: e.stats_spd,
              luck: e.stats_luck,
            },
            specialAbility: e.special_ability,
            specialDesc: e.special_desc,
          }))
        }
      }

      // Fallback: pick enemies based on dungeon difficulty
      if (enemies.length === 0) {
        const { data: allEnemies } = await supabaseAdmin
          .from('battle_enemies')
          .select('*')
          .eq('is_active', true)

        if (allEnemies && allEnemies.length > 0) {
          // Pick 1-3 enemies appropriate for the difficulty
          const appropriateEnemies = allEnemies
            .filter((e: any) => {
              if (dungeon.difficulty <= 3) return e.tier === 'normal'
              if (dungeon.difficulty <= 6) return ['normal', 'elite'].includes(e.tier)
              if (dungeon.difficulty <= 10) return ['elite', 'boss'].includes(e.tier)
              return ['boss', 'legendary'].includes(e.tier)
            })
            .sort((a: any, b: any) => a.level - b.level)

          if (appropriateEnemies.length === 0) {
            // Fallback to any enemies
            enemies = allEnemies.slice(0, Math.min(3, dungeon.difficulty <= 5 ? 1 : dungeon.difficulty <= 10 ? 2 : 3))
              .map((e: any) => ({
                id: e.id,
                name: e.name,
                nameRu: e.name_ru,
                anime: e.anime,
                imageUrl: e.image_url,
                level: e.level,
                tier: e.tier,
                stats: {
                  hp: e.stats_hp,
                  atk: e.stats_atk,
                  def: e.stats_def,
                  spd: e.stats_spd,
                  luck: e.stats_luck,
                },
                specialAbility: e.special_ability,
                specialDesc: e.special_desc,
              }))
          } else {
            const enemyCount = Math.min(3, Math.max(1, Math.ceil(dungeon.difficulty / 4)))
            const shuffled = appropriateEnemies.sort(() => Math.random() - 0.5)
            enemies = shuffled.slice(0, enemyCount).map((e: any) => ({
              id: e.id,
              name: e.name,
              nameRu: e.name_ru,
              anime: e.anime,
              imageUrl: e.image_url,
              level: e.level,
              tier: e.tier,
              stats: {
                hp: e.stats_hp,
                atk: e.stats_atk,
                def: e.stats_def,
                spd: e.stats_spd,
                luck: e.stats_luck,
              },
              specialAbility: e.special_ability,
              specialDesc: e.special_desc,
            }))
          }
        }
      }

      if (enemies.length === 0) {
        return NextResponse.json({
          success: false,
          message: "Нет доступных врагов для этого подземелья"
        }, { status: 500 })
      }

      // 4. Convert player cards to battle format
      const battleCards: BattleCard[] = playerCards.map((c: any) => {
        console.log(`[Battle API] Card ${c.name}: hp=${c.stats?.hp || c.stats_hp || 0}, atk=${c.stats?.atk || c.stats_atk || 0}`)
        
        return {
          uniqueId: c.uniqueId || c.unique_id,
          name: c.name,
          anime: c.anime,
          rarity: c.rarity,
          imageUrl: c.imageUrl || c.image_url,
          stats: {
            hp: c.stats?.hp || c.stats_hp || 0, // Use max HP for battle calculations
            atk: c.stats?.atk || c.stats_atk || 0,
            def: c.stats?.def || c.stats_def || 0,
            spd: c.stats?.spd || c.stats_spd || 0,
            luck: c.stats?.luck || c.stats_luck || 0,
          },
          isMainCharacter: c.isMainCharacter || c.is_main_character || false,
        }
      })

      // 5. Execute battle
      const result = executeBattle(battleCards, enemies, dungeon.difficulty)

      // 6. Deduct stamina and update progress
      const isDailyBattle = dungeonId.startsWith('daily-')
      const today = new Date().toISOString().split('T')[0]
      
      await supabaseAdmin
        .from('user_battle_progress')
        .update({
          current_stamina: progress.current_stamina - dungeon.energy_cost,
          total_battles: progress.total_battles + 1,
          total_wins: progress.total_wins + (result.victory ? 1 : 0),
          total_losses: progress.total_losses + (result.victory ? 0 : 1),
          daily_battles_today: isDailyBattle ? progress.daily_battles_today + 1 : progress.daily_battles_today,
          last_daily_reset: today,
        })
        .eq('user_id', user.id)

      // 7. Apply rewards
      if (result.victory) {
        // Use daily rewards for daily battles, otherwise use dungeon rewards
        const coinsToAward = isDailyBattle ? dungeon.coins_reward_base : result.coinsEarned
        const dustToAward = isDailyBattle ? dungeon.dust_reward_base : result.dustEarned
        const xpToAward = isDailyBattle ? dungeon.xp_reward_base : result.xpEarned

        // Add coins
        try {
          await supabaseAdmin.rpc('add_coins_secure', {
            p_user_id: user.id,
            p_amount: coinsToAward,
          })
        } catch {
          // Fallback if RPC doesn't exist
          await supabaseAdmin
            .from('user_coins')
            .update({ coins: coinsToAward, updated_at: new Date().toISOString() })
            .eq('id', user.id)
        }

        // Add dust
        try {
          await supabaseAdmin.rpc('add_dust_secure', {
            p_user_id: user.id,
            p_amount: dustToAward,
          })
        } catch {
          await supabaseAdmin
            .from('user_dust')
            .update({ dust: dustToAward, updated_at: new Date().toISOString() })
            .eq('id', user.id)
        }

        // Add XP and handle level up
        const { data: updatedProgress } = await supabaseAdmin
          .from('user_battle_progress')
          .select('xp, xp_to_next, level')
          .eq('user_id', user.id)
          .single()

        if (updatedProgress) {
          const newXp = updatedProgress.xp + xpToAward
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
                  (progress.current_stamina - dungeon.energy_cost) + 2 // Bonus stamina on level up
                ),
                highest_dungeon_cleared: Math.max(
                  progress.highest_dungeon_cleared || 0,
                  dungeon.difficulty
                ),
              })
              .eq('user_id', user.id)
          } else {
            await supabaseAdmin
              .from('user_battle_progress')
              .update({
                xp: newXp,
                highest_dungeon_cleared: Math.max(
                  progress.highest_dungeon_cleared || 0,
                  dungeon.difficulty
                ),
              })
              .eq('user_id', user.id)
          }
        }

        // Update battle result with actual awarded values
        result.coinsEarned = coinsToAward
        result.dustEarned = dustToAward
        result.xpEarned = xpToAward
      }

      // 8. Save battle log
      await supabaseAdmin
        .from('battle_logs')
        .insert({
          user_id: user.id,
          dungeon_id: dungeonId,
          result: result.victory ? 'win' : 'loss',
          player_cards: cardUniqueIds,
          enemy_ids: enemies.map(e => e.id),
          coins_earned: result.coinsEarned,
          dust_earned: result.dustEarned,
          xp_earned: result.xpEarned,
          battle_turns: result.turns,
          player_hp_remaining: result.playerUnits.reduce((sum, u) => sum + Math.max(0, u.hpRemaining), 0),
          enemy_hp_remaining: result.enemyUnits.reduce((sum, u) => sum + Math.max(0, u.hpRemaining), 0),
          battle_data: {
            actions: result.actions.slice(-10), // Store last 10 actions to save space
            mvp: result.mvpCard,
          },
        })

      // 9. Return battle result
      return NextResponse.json({
        success: true,
        battle: result,
        staminaUsed: dungeon.energy_cost,
      })
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error('[Battle API POST] Error:', error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
