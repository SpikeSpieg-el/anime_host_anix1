// lib/battle-engine.ts - Core PVE battle logic
// All calculations happen server-side to prevent cheating

import { Rarity, rarityConfig } from "@/types/gacha"

// ==========================================
// TYPES
// ==========================================

export interface BattleCard {
  uniqueId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  stats: {
    hp: number
    atk: number
    def: number
    spd: number
    luck: number
  }
  isMainCharacter?: boolean
}

export interface BattleEnemy {
  id: string
  name: string
  nameRu: string
  anime?: string
  imageUrl?: string
  level: number
  tier: "normal" | "elite" | "boss" | "legendary"
  stats: {
    hp: number
    atk: number
    def: number
    spd: number
    luck: number
  }
  specialAbility?: string
  specialDesc?: string
}

export interface BattleUnit {
  uniqueId: string
  name: string
  anime?: string
  imageUrl?: string
  stats: {
    hp: number
    atk: number
    def: number
    spd: number
    luck: number
  }
  tier?: string
  specialAbility?: string
  specialDesc?: string
  currentHp: number
  maxHp: number
  isPlayer: boolean
  statusEffects: StatusEffect[]
}

export interface StatusEffect {
  type: "stun" | "def_up" | "atk_up" | "atk_down" | "def_down" | "regen" | "bleed" | "shield"
  turnsLeft: number
  value: number
  source: string
}

export interface BattleAction {
  turn: number
  attackerId: string
  attackerName: string
  defenderId: string
  defenderName: string
  isPlayerAttack: boolean
  damage: number
  isCritical: boolean
  isDodged: boolean
  abilityUsed?: string
  abilityDesc?: string
  statusApplied?: string
  defenderHpAfter: number
  defenderMaxHp: number
}

export interface BattleResult {
  victory: boolean
  turns: number
  actions: BattleAction[]
  playerUnits: (BattleUnit & { hpRemaining: number; totalDamageDealt: number; totalDamageReceived: number })[]
  enemyUnits: (BattleUnit & { hpRemaining: number; totalDamageDealt: number; totalDamageReceived: number })[]
  coinsEarned: number
  dustEarned: number
  xpEarned: number
  mvpCard?: {
    uniqueId: string
    name: string
    totalDamageDealt: number
    anime: string
    imageUrl: string
  }
}

// ==========================================
// STAT SCALING
// ==========================================

// Scale card stats based on rarity for battle calculations
function getRarityMultiplier(rarity: Rarity): number {
  const multipliers: Record<Rarity, number> = {
    trash: 0.5,
    common: 0.7,
    uncommon: 0.85,
    rare: 1.0,
    super_rare: 1.2,
    epic: 1.45,
    mythic: 1.7,
    legendary: 2.0,
    ancient: 2.4,
    divine: 2.8,
    transcendent: 3.3,
    omnipotent: 4.0,
  }
  return multipliers[rarity] || 1.0
}

// Main character bonus
function getMainCharBonus(isMainCharacter: boolean): number {
  return isMainCharacter ? 1.15 : 1.0
}

// ==========================================
// DAMAGE FORMULA
// ==========================================

function calculateDamage(
  attacker: BattleUnit,
  defender: BattleUnit,
): { damage: number; isCritical: boolean; isDodged: boolean } {
  // Base damage = ATK * (ATK / (ATK + DEF))
  const atkMod = getStatusEffectModifier(attacker.statusEffects, "atk_up") -
    getStatusEffectModifier(attacker.statusEffects, "atk_down")
  const defMod = getStatusEffectModifier(defender.statusEffects, "def_up") -
    getStatusEffectModifier(defender.statusEffects, "def_down")

  const effectiveAtk = Math.max(1, attacker.stats.atk * (1 + atkMod))
  const effectiveDef = Math.max(1, defender.stats.def * (1 + defMod))

  // Check for dodge (based on speed difference + luck)
  const dodgeChance = Math.min(0.3, (defender.stats.spd - attacker.stats.spd) * 0.01 + defender.stats.luck * 0.001)
  if (Math.random() < dodgeChance) {
    return { damage: 0, isCritical: false, isDodged: true }
  }

  // Base damage
  let damage = effectiveAtk * (effectiveAtk / (effectiveAtk + effectiveDef)) * (10 + Math.random() * 5)

  // Critical hit check (based on luck)
  const critChance = Math.min(0.4, 0.05 + attacker.stats.luck * 0.003)
  const isCritical = Math.random() < critChance
  if (isCritical) {
    damage *= 1.5 + attacker.stats.luck * 0.002
  }

  // Bleed damage bonus
  const bleedBonus = getStatusEffectModifier(defender.statusEffects, "bleed")
  if (bleedBonus > 0) {
    damage *= (1 + bleedBonus * 0.1)
  }

  // Shield reduction
  const shieldReduction = getStatusEffectModifier(defender.statusEffects, "shield")
  if (shieldReduction > 0) {
    damage *= Math.max(0.3, 1 - shieldReduction * 0.15)
  }

  // Round and ensure minimum damage
  damage = Math.max(1, Math.round(damage))

  return { damage, isCritical, isDodged: false }
}

function getStatusEffectModifier(effects: StatusEffect[], type: StatusEffect["type"]): number {
  return effects.filter(e => e.type === type).reduce((sum, e) => sum + e.value, 0)
}

// ==========================================
// BATTLE ENGINE
// ==========================================

export function executeBattle(
  playerCards: BattleCard[],
  enemies: BattleEnemy[],
  dungeonDifficulty: number = 1,
): BattleResult {
  // Create player units with scaled stats
  const playerUnits: BattleUnit[] = playerCards.map(card => {
    const rarityMult = getRarityMultiplier(card.rarity)
    const mainCharMult = getMainCharBonus(card.isMainCharacter || false)
    const scaledHp = Math.round(card.stats.hp * rarityMult * mainCharMult * 3) // HP gets 3x multiplier for longer battles

    console.log(`[Battle] Creating unit ${card.name}: original HP=${card.stats.hp}, scaled=${scaledHp}, rarity=${card.rarity}, mainChar=${card.isMainCharacter}`)

    return {
      ...card,
      currentHp: scaledHp, // Always start with full HP
      maxHp: scaledHp,
      isPlayer: true,
      statusEffects: [],
      stats: {
        hp: scaledHp,
        atk: Math.round(card.stats.atk * rarityMult * mainCharMult),
        def: Math.round(card.stats.def * rarityMult * mainCharMult),
        spd: Math.round(card.stats.spd * rarityMult * mainCharMult),
        luck: Math.round(card.stats.luck * rarityMult * mainCharMult),
      },
    }
  })

  // Create enemy units (scale slightly with dungeon difficulty)
  const enemyUnits: BattleUnit[] = enemies.map(enemy => {
    const diffScale = 1 + (dungeonDifficulty - 1) * 0.05
    const tierScale = getEnemyTierScale(enemy.tier)

    return {
      ...enemy,
      uniqueId: enemy.id,
      currentHp: Math.round(enemy.stats.hp * diffScale * tierScale),
      maxHp: Math.round(enemy.stats.hp * diffScale * tierScale),
      isPlayer: false,
      statusEffects: [],
      stats: {
        hp: Math.round(enemy.stats.hp * diffScale * tierScale),
        atk: Math.round(enemy.stats.atk * diffScale * tierScale),
        def: Math.round(enemy.stats.def * diffScale * tierScale),
        spd: Math.round(enemy.stats.spd * diffScale * tierScale),
        luck: Math.round(enemy.stats.luck * diffScale * tierScale),
      },
    }
  })

  // Track stats per unit
  const unitStats: Record<string, { totalDamageDealt: number; totalDamageReceived: number }> = {}
  const allUnits = [...playerUnits, ...enemyUnits]
  allUnits.forEach(u => {
    unitStats[u.uniqueId] = { totalDamageDealt: 0, totalDamageReceived: 0 }
  })

  const actions: BattleAction[] = []
  let turn = 0
  const MAX_TURNS = 30

  while (turn < MAX_TURNS) {
    turn++

    // Check if battle is over
    const alivePlayers = playerUnits.filter(u => u.currentHp > 0)
    const aliveEnemies = enemyUnits.filter(u => u.currentHp > 0)

    if (alivePlayers.length === 0) {
      // Player loses
      return buildResult(false, turn, actions, playerUnits, enemyUnits, unitStats, 0, 0, 0)
    }

    if (aliveEnemies.length === 0) {
      // Player wins!
      const { coins, dust, xp } = calculateRewards(dungeonDifficulty, enemies, turn)
      return buildResult(true, turn, actions, playerUnits, enemyUnits, unitStats, coins, dust, xp)
    }

    // Sort all alive units by speed (fastest goes first)
    const turnOrder = [...alivePlayers, ...aliveEnemies]
      .sort((a, b) => {
        const spdDiff = b.stats.spd - a.stats.spd
        if (spdDiff !== 0) return spdDiff
        // Tiebreaker: random
        return Math.random() - 0.5
      })

    for (const unit of turnOrder) {
      // Skip stunned units
      if (unit.statusEffects.some(e => e.type === "stun")) {
        unit.statusEffects = unit.statusEffects
          .map(e => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
          .filter(e => e.turnsLeft > 0)
        continue
      }

      // Find valid targets
      const targets = unit.isPlayer
        ? enemyUnits.filter(e => e.currentHp > 0)
        : playerUnits.filter(p => p.currentHp > 0)

      if (targets.length === 0) break

      // Target selection: enemies target lowest HP player card
      const target = unit.isPlayer
        ? targets.reduce((lowest, t) => t.currentHp < lowest.currentHp ? t : lowest, targets[0])
        : targets.reduce((lowest, t) => t.currentHp < lowest.currentHp ? t : lowest, targets[0])

      // Check for special abilities
      const abilityResult = tryUseAbility(unit, target, targets, unit.isPlayer ? enemyUnits : playerUnits)
      if (abilityResult) {
        // Process ability effects
        if (abilityResult.damage) {
          if (abilityResult.isAoe) {
            // AOE damage to all targets
            for (const aoeTarget of targets) {
              const { damage, isCritical, isDodged } = calculateDamage(unit, aoeTarget)
              const finalDamage = Math.round(damage * (abilityResult.damageMultiplier || 1))
              aoeTarget.currentHp = Math.max(0, aoeTarget.currentHp - finalDamage)
              unitStats[unit.uniqueId].totalDamageDealt += finalDamage
              unitStats[aoeTarget.uniqueId].totalDamageReceived += finalDamage

              actions.push({
                turn,
                attackerId: unit.uniqueId,
                attackerName: unit.name,
                defenderId: aoeTarget.uniqueId,
                defenderName: aoeTarget.name,
                isPlayerAttack: unit.isPlayer,
                damage: finalDamage,
                isCritical,
                isDodged,
                abilityUsed: abilityResult.name,
                abilityDesc: abilityResult.desc,
                defenderHpAfter: aoeTarget.currentHp,
                defenderMaxHp: aoeTarget.maxHp,
              })
            }
          } else {
            const { damage, isCritical, isDodged } = calculateDamage(unit, target)
            const finalDamage = Math.round(damage * (abilityResult.damageMultiplier || 1))
            target.currentHp = Math.max(0, target.currentHp - finalDamage)
            unitStats[unit.uniqueId].totalDamageDealt += finalDamage
            unitStats[target.uniqueId].totalDamageReceived += finalDamage

            actions.push({
              turn,
              attackerId: unit.uniqueId,
              attackerName: unit.name,
              defenderId: target.uniqueId,
              defenderName: target.name,
              isPlayerAttack: unit.isPlayer,
              damage: finalDamage,
              isCritical,
              isDodged,
              abilityUsed: abilityResult.name,
              abilityDesc: abilityResult.desc,
              defenderHpAfter: target.currentHp,
              defenderMaxHp: target.maxHp,
            })
          }
        }

        if (abilityResult.statusEffect) {
          const effectTarget = abilityResult.statusTarget === "all_allies"
            ? (unit.isPlayer ? playerUnits : enemyUnits).filter(u => u.currentHp > 0)
            : abilityResult.statusTarget === "all_enemies"
              ? targets
              : [target]

          for (const et of effectTarget) {
            et.statusEffects.push({
              type: abilityResult.statusEffect.type,
              turnsLeft: abilityResult.statusEffect.turnsLeft,
              value: abilityResult.statusEffect.value,
              source: abilityResult.name,
            })
          }
        }

        continue
      }

      // Normal attack
      const { damage, isCritical, isDodged } = calculateDamage(unit, target)
      target.currentHp = Math.max(0, target.currentHp - damage)
      unitStats[unit.uniqueId].totalDamageDealt += damage
      unitStats[target.uniqueId].totalDamageReceived += damage

      actions.push({
        turn,
        attackerId: unit.uniqueId,
        attackerName: unit.name,
        defenderId: target.uniqueId,
        defenderName: target.name,
        isPlayerAttack: unit.isPlayer,
        damage,
        isCritical,
        isDodged,
        defenderHpAfter: target.currentHp,
        defenderMaxHp: target.maxHp,
      })

      // Regeneration check
      const regenEffects = unit.statusEffects.filter(e => e.type === "regen")
      for (const regen of regenEffects) {
        const healAmount = Math.round(unit.maxHp * 0.05 * regen.value)
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmount)
      }
    }

    // Process end of turn effects
    for (const unit of allUnits) {
      if (unit.currentHp <= 0) continue

      // Tick down status effects
      unit.statusEffects = unit.statusEffects
        .map(e => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
        .filter(e => e.turnsLeft > 0)
    }
  }

  // Max turns reached — draw counts as loss
  return buildResult(false, MAX_TURNS, actions, playerUnits, enemyUnits, unitStats, 0, 0, 0)
}

function buildResult(
  victory: boolean,
  turns: number,
  actions: BattleAction[],
  playerUnits: BattleUnit[],
  enemyUnits: BattleUnit[],
  unitStats: Record<string, { totalDamageDealt: number; totalDamageReceived: number }>,
  coinsEarned: number,
  dustEarned: number,
  xpEarned: number,
): BattleResult {
  // Find MVP
  let mvpCard: BattleResult["mvpCard"] = undefined
  let maxDamage = 0
  for (const pu of playerUnits) {
    const stats = unitStats[pu.uniqueId]
    if (stats.totalDamageDealt > maxDamage) {
      maxDamage = stats.totalDamageDealt
      mvpCard = {
        uniqueId: pu.uniqueId,
        name: pu.name,
        totalDamageDealt: stats.totalDamageDealt,
        anime: pu.anime || "",
        imageUrl: ("imageUrl" in pu) ? pu.imageUrl || "" : "",
      }
    }
  }

  return {
    victory,
    turns,
    actions,
    playerUnits: playerUnits.map(pu => ({
      ...pu,
      hpRemaining: pu.currentHp,
      totalDamageDealt: unitStats[pu.uniqueId].totalDamageDealt,
      totalDamageReceived: unitStats[pu.uniqueId].totalDamageReceived,
    })),
    enemyUnits: enemyUnits.map(eu => ({
      ...eu,
      hpRemaining: eu.currentHp,
      totalDamageDealt: unitStats[eu.uniqueId].totalDamageDealt,
      totalDamageReceived: unitStats[eu.uniqueId].totalDamageReceived,
    })),
    coinsEarned,
    dustEarned,
    xpEarned,
    mvpCard,
  }
}

function getEnemyTierScale(tier: BattleEnemy["tier"]): number {
  const scales: Record<BattleEnemy["tier"], number> = {
    normal: 1.0,
    elite: 1.5,
    boss: 2.0,
    legendary: 3.0,
  }
  return scales[tier] || 1.0
}

function calculateRewards(
  dungeonDifficulty: number,
  enemies: BattleEnemy[],
  turnsUsed: number,
): { coins: number; dust: number; xp: number } {
  const efficiencyBonus = Math.max(0.5, 1.5 - turnsUsed * 0.05) // Faster = more rewards

  const baseCoins = enemies.reduce((sum, e) => {
    const tierBonus: Record<string, number> = { normal: 1, elite: 2, boss: 5, legendary: 10 }
    return sum + 50 * (tierBonus[e.tier] || 1) * dungeonDifficulty
  }, 0)

  const baseDust = enemies.reduce((sum, e) => {
    const tierBonus: Record<string, number> = { normal: 0, elite: 1, boss: 3, legendary: 8 }
    return sum + 10 * (tierBonus[e.tier] || 0) * dungeonDifficulty
  }, 0)

  const baseXp = enemies.reduce((sum, e) => {
    const tierBonus: Record<string, number> = { normal: 1, elite: 2, boss: 4, legendary: 8 }
    return sum + 20 * (tierBonus[e.tier] || 1) * dungeonDifficulty
  }, 0)

  return {
    coins: Math.round(baseCoins * efficiencyBonus),
    dust: Math.round(baseDust * efficiencyBonus),
    xp: Math.round(baseXp * efficiencyBonus),
  }
}

// ==========================================
// ABILITY SYSTEM
// ==========================================

interface AbilityResult {
  damage: boolean
  damageMultiplier?: number
  isAoe?: boolean
  statusEffect?: {
    type: StatusEffect["type"]
    turnsLeft: number
    value: number
    source?: string
  }
  statusTarget?: "target" | "self" | "all_allies" | "all_enemies"
  name: string
  desc: string
}

const ENEMY_ABILITIES: Record<string, (unit: BattleUnit, target: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[]) => AbilityResult | null> = {
  shadow_strike: () => ({
    damage: true,
    damageMultiplier: 1.3,
    name: "Атака Тенью",
    desc: "+30% урон",
  }),
  iron_wall: () => ({
    damage: false,
    statusEffect: { type: "def_up", turnsLeft: 2, value: 1 },
    statusTarget: "self",
    name: "Железная Стена",
    desc: "+100% защиты на 2 хода",
  }),
  roar: (_unit, _target, _allies, enemies) => {
    const validTargets = enemies.filter(e => e.currentHp > 0)
    if (validTargets.length === 0) return null
    return {
      damage: false,
      statusEffect: { type: "stun", turnsLeft: 1, value: 1 },
      statusTarget: "target",
      name: "Рёв Титана",
      desc: "Оглушает врага на 1 ход",
    }
  },
  domain_expansion: () => ({
    damage: true,
    damageMultiplier: 1.8,
    isAoe: true,
    name: "Расширение Территории",
    desc: "Мощная атака по всем врагам",
  }),
  blood_art: () => ({
    damage: true,
    damageMultiplier: 1.2,
    statusEffect: { type: "regen", turnsLeft: 3, value: 1 },
    statusTarget: "self",
    name: "Кровавое Искусство",
    desc: "Атака + восстановление HP",
  }),
  regeneration: () => ({
    damage: false,
    statusEffect: { type: "regen", turnsLeft: 3, value: 2 },
    statusTarget: "self",
    name: "Регенерация",
    desc: "Восстановление HP каждый ход",
  }),
  rage_mode: (unit) => {
    if (unit.currentHp < unit.maxHp * 0.3) {
      return {
        damage: false,
        statusEffect: { type: "atk_up", turnsLeft: 3, value: 1 },
        statusTarget: "self",
        name: "Режим Ярости",
        desc: "ATK +100% на 3 хода!",
      }
    }
    return null
  },
  cero: () => ({
    damage: true,
    damageMultiplier: 1.5,
    isAoe: true,
    name: "Серо",
    desc: "Мощная атака по всем картам",
  }),
  shadow_clones: () => ({
    damage: false,
    statusEffect: { type: "atk_up", turnsLeft: 2, value: 0.5 },
    statusTarget: "all_allies",
    name: "Теневые Клоны",
    desc: "Все союзники +50% ATK",
  }),
  kyoka_suigetsu: () => ({
    damage: false,
    statusEffect: { type: "def_down", turnsLeft: 1, value: 2 },
    statusTarget: "all_enemies",
    name: "Полная Гипноз",
    desc: "Враги теряют защиту на 1 ход",
  }),
  susano_o: () => ({
    damage: false,
    statusEffect: { type: "shield", turnsLeft: 2, value: 3 },
    statusTarget: "self",
    name: "Сусано'о",
    desc: "Непробиваемая защита на 2 хода",
  }),
  infinite_void: () => ({
    damage: false,
    statusEffect: { type: "stun", turnsLeft: 1, value: 1 },
    statusTarget: "all_enemies",
    name: "Бесконечная Пустота",
    desc: "Все враги пропускают 1 ход",
  }),
  apocalypse: () => ({
    damage: true,
    damageMultiplier: 2.0,
    isAoe: true,
    statusEffect: { type: "bleed", turnsLeft: 3, value: 2 },
    statusTarget: "all_enemies",
    name: "Апокалипсис",
    desc: "Массированная атака + кровотечение",
  }),
  divine_judgment: () => ({
    damage: true,
    damageMultiplier: 3.0,
    name: "Божественный Суд",
    desc: "Разрушительный одномоментный удар",
  }),
}

function tryUseAbility(
  unit: BattleUnit,
  target: BattleUnit,
  targets: BattleUnit[],
  allies: BattleUnit[],
): AbilityResult | null {
  // Player cards don't use abilities in this version
  if (unit.isPlayer) return null

  const enemyUnit = unit as BattleUnit & { specialAbility?: string }
  const abilityKey = enemyUnit.specialAbility
  if (!abilityKey) return null

  // 30% chance to use ability each turn
  if (Math.random() > 0.3) return null

  const abilityFn = ENEMY_ABILITIES[abilityKey]
  if (!abilityFn) return null

  return abilityFn(unit, target, allies, targets)
}

// ==========================================
// ENEMY POWER CALCULATION
// ==========================================

export function calculateEnemyPower(enemy: BattleEnemy): number {
  const totalStats = enemy.stats.hp + enemy.stats.atk * 2 + enemy.stats.def + enemy.stats.spd + enemy.stats.luck
  const tierScale = getEnemyTierScale(enemy.tier)
  return Math.round(totalStats * tierScale)
}

export function calculateEnemyTeamPower(enemies: BattleEnemy[]): {
  totalPower: number
  avgPower: number
  rating: string
  ratingColor: string
} {
  if (enemies.length === 0) {
    return { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }
  }

  const powers = enemies.map(enemy => calculateEnemyPower(enemy))
  const totalPower = powers.reduce((sum, p) => sum + p, 0)
  const avgPower = Math.round(totalPower / enemies.length)

  let rating: string
  let ratingColor: string

  if (avgPower >= 800) { rating = "SSS"; ratingColor = "from-red-400 to-rose-600" }
  else if (avgPower >= 600) { rating = "SS"; ratingColor = "from-orange-400 to-red-500" }
  else if (avgPower >= 450) { rating = "S"; ratingColor = "from-amber-400 to-orange-500" }
  else if (avgPower >= 350) { rating = "A"; ratingColor = "from-yellow-400 to-amber-500" }
  else if (avgPower >= 250) { rating = "B"; ratingColor = "from-lime-400 to-green-500" }
  else if (avgPower >= 150) { rating = "C"; ratingColor = "from-blue-400 to-indigo-500" }
  else if (avgPower >= 80) { rating = "D"; ratingColor = "from-slate-400 to-slate-500" }
  else { rating = "F"; ratingColor = "from-stone-500 to-stone-700" }

  return { totalPower, avgPower, rating, ratingColor }
}

// ==========================================
// TEAM POWER CALCULATION
// ==========================================

export function getCardPower(card: BattleCard): number {
  const rarityMult = getRarityMultiplier(card.rarity)
  const mainCharMult = getMainCharBonus(card.isMainCharacter || false)
  const totalStats = card.stats.hp + card.stats.atk * 2 + card.stats.def + card.stats.spd + card.stats.luck
  return Math.round(totalStats * rarityMult * mainCharMult)
}

export function calculateTeamPower(cards: BattleCard[]): {
  totalPower: number
  avgPower: number
  rating: string
  ratingColor: string
} {
  if (cards.length === 0) {
    return { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }
  }

  const powers = cards.map(card => {
    const rarityMult = getRarityMultiplier(card.rarity)
    const mainCharMult = getMainCharBonus(card.isMainCharacter || false)
    const totalStats = card.stats.hp + card.stats.atk * 2 + card.stats.def + card.stats.spd + card.stats.luck
    return Math.round(totalStats * rarityMult * mainCharMult)
  })

  const totalPower = powers.reduce((sum, p) => sum + p, 0)
  const avgPower = Math.round(totalPower / cards.length)

  let rating: string
  let ratingColor: string

  if (avgPower >= 800) { rating = "SSS"; ratingColor = "from-white via-yellow-200 to-amber-500" }
  else if (avgPower >= 600) { rating = "SS"; ratingColor = "from-amber-400 to-orange-500" }
  else if (avgPower >= 450) { rating = "S"; ratingColor = "from-pink-400 to-rose-600" }
  else if (avgPower >= 350) { rating = "A"; ratingColor = "from-purple-500 to-pink-500" }
  else if (avgPower >= 250) { rating = "B"; ratingColor = "from-blue-400 to-cyan-500" }
  else if (avgPower >= 150) { rating = "C"; ratingColor = "from-emerald-400 to-teal-500" }
  else if (avgPower >= 80) { rating = "D"; ratingColor = "from-slate-400 to-slate-500" }
  else { rating = "F"; ratingColor = "from-stone-500 to-stone-700" }

  return { totalPower, avgPower, rating, ratingColor }
}

// ==========================================
// STAMINA CALCULATIONS
// ==========================================

export function calculateStaminaRefill(lastRefill: string, currentStamina: number, maxStamina: number): {
  stamina: number
  nextRefillMs: number
  canRefill: boolean
} {
  const lastTime = new Date(lastRefill).getTime()
  const now = Date.now()
  const elapsedMs = now - lastTime
  const staminaPerHour = 1
  const msPerStamina = (60 * 60 * 1000) / staminaPerHour // 1 stamina per hour
  const staminaToRegen = Math.floor(elapsedMs / msPerStamina)

  const newStamina = Math.min(maxStamina, currentStamina + staminaToRegen)
  const nextRefillMs = newStamina < maxStamina
    ? msPerStamina - (elapsedMs % msPerStamina)
    : 0
  const canRefill = staminaToRegen > 0

  return { stamina: newStamina, nextRefillMs, canRefill }
}

// ==========================================
// LEVEL UP SYSTEM
// ==========================================

export function calculateLevelUp(xp: number, xpToNext: number, currentLevel: number): {
  leveledUp: boolean
  newLevel: number
  newXp: number
  newXpToNext: number
  newMaxStamina: number
} {
  if (xp < xpToNext) {
    return {
      leveledUp: false,
      newLevel: currentLevel,
      newXp: xp,
      newXpToNext: xpToNext,
      newMaxStamina: 10 + Math.floor(currentLevel / 5),
    }
  }

  let remainingXp = xp - xpToNext
  let level = currentLevel + 1
  let xpToNextLevel = Math.round(100 * Math.pow(1.3, level - 1))
  let levelsGained = 1

  while (remainingXp >= xpToNextLevel) {
    remainingXp -= xpToNextLevel
    level++
    xpToNextLevel = Math.round(100 * Math.pow(1.3, level - 1))
    levelsGained++
    if (levelsGained > 10) break // Safety cap
  }

  return {
    leveledUp: true,
    newLevel: level,
    newXp: remainingXp,
    newXpToNext: xpToNextLevel,
    newMaxStamina: 10 + Math.floor(level / 5),
  }
}
