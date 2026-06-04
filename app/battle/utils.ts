import { Dungeon, Enemy, Card, CardRole, ZoneCard, BattleZone } from "./types"
import { calculateEnemyTeamPower } from "@/lib/battle-engine"
import { RARITY_PROVISION_MAP } from "./config"

// Calculate Enemy dungeon power for old compatibility/reference (if needed)
export const getDungeonEnemyPower = (dungeon: Dungeon, enemies: Enemy[]) => {
  let dungeonEnemies: Enemy[] = []
  if (dungeon.enemy_ids && dungeon.enemy_ids.length > 0) {
    dungeonEnemies = enemies.filter(enemy => dungeon.enemy_ids!.includes(enemy.id))
  } else {
    const map: Record<string, number> = { normal: 1, elite: 3, boss: 5, legendary: 7 }
    const appropriate = enemies.filter(e => Math.abs((map[e.tier] || 1) - dungeon.difficulty) <= 1)
    const count = Math.min(3, Math.max(1, Math.ceil(dungeon.difficulty / 2)))
    dungeonEnemies = appropriate.sort(() => Math.random() - 0.5).slice(0, count)
  }
  if (dungeonEnemies.length === 0) return { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }

  const mapped = dungeonEnemies.map(e => ({
    id: e.id, name: e.name, nameRu: e.name_ru, anime: e.anime, imageUrl: e.image_url, level: e.level, tier: e.tier,
    stats: { hp: e.stats_hp, atk: e.stats_atk, def: e.stats_def, spd: e.stats_spd, luck: e.stats_luck },
    specialAbility: e.special_ability, specialDesc: e.special_desc,
  }))
  return calculateEnemyTeamPower(mapped)
}

// CCG Card Helper functions
export const getCardRole = (card: Card): CardRole => {
  // Normalize HP since hp values are typically larger than other stats (e.g. 500 hp vs 50 atk)
  const hpWeight = card.stats.hp / 8
  const atkWeight = card.stats.atk
  const defWeight = card.stats.def
  const spdWeight = card.stats.spd
  const luckWeight = card.stats.luck

  const options = [
    { role: "guard", value: Math.max(hpWeight, defWeight) },
    { role: "vanguard", value: atkWeight },
    { role: "trickster", value: Math.max(spdWeight, luckWeight) }
  ]

  options.sort((a, b) => b.value - a.value)
  return options[0].role as CardRole
}

export const getCardProvision = (card: Card): number => {
  return RARITY_PROVISION_MAP[card.rarity] !== undefined ? RARITY_PROVISION_MAP[card.rarity] : 4
}

export const getCardBasePower = (card: Card): number => {
  // Base power formula representing card's overall stat weight
  return Math.round((card.stats.hp + card.stats.atk * 2.5 + card.stats.def * 1.5 + card.stats.spd * 1.2 + card.stats.luck) / 4)
}

// KNB (Rock-Paper-Scissors) Matchup calculation
export const getKNBBonusMultiplier = (attackerRole: CardRole, defenderRole: CardRole, reverse: boolean = false): number => {
  if (!reverse) {
    // Vanguard > Trickster
    // Guard > Vanguard
    // Trickster > Guard
    if (attackerRole === "vanguard" && defenderRole === "trickster") return 0.5
    if (attackerRole === "guard" && defenderRole === "vanguard") return 0.5
    if (attackerRole === "trickster" && defenderRole === "guard") return 0.5
  } else {
    // Reverse: Trickster > Vanguard > Guard > Trickster
    if (attackerRole === "trickster" && defenderRole === "vanguard") return 0.5
    if (attackerRole === "vanguard" && defenderRole === "guard") return 0.5
    if (attackerRole === "guard" && defenderRole === "trickster") return 0.5
  }
  return 0
}

// Apply territory effects
export const calculateCardPowerOnZone = (
  card: Card,
  zoneModifierId: string,
  allEnemyCardsOnZone: ZoneCard[] = [],
  allPlayerCardsOnZone: ZoneCard[] = [],
  isRevealed: boolean = true,
  wasSecret: boolean = false,
  isPlayerCard: boolean = true
): { power: number; roleMatchupBonus: number } => {
  let basePower = getCardBasePower(card)
  const role = card.role || getCardRole(card)
  const provision = card.provisionCost || getCardProvision(card)

  // Helpers
  const myCards = isPlayerCard ? allPlayerCardsOnZone : allEnemyCardsOnZone
  const enemyCards = isPlayerCard ? allEnemyCardsOnZone : allPlayerCardsOnZone
  const isGuard = role === "guard"
  const isVandalism = zoneModifierId === "vandalism"
  const hasIronCurtain = zoneModifierId === "iron_curtain" && isGuard

  // === SYSTEM / EQUALITY ===
  if (zoneModifierId === "equality") {
    return { power: 150, roleMatchupBonus: 0 }
  }

  // === RARITY OVERRIDES ===
  if (zoneModifierId === "fools_gold" && (card.rarity === "legendary" || card.rarity === "mythic")) {
    basePower = 50
  }

  // === SECRET / OPEN INTERACTIONS ===
  switch (zoneModifierId) {
    case "shadow_step":
      if (wasSecret) basePower += 100
      break
    case "mirage_zone":
      if (wasSecret) basePower *= 2
      else basePower *= 0.5
      break
    case "first_strike":
      if (!wasSecret) basePower += 80
      break
    case "ambush_point":
      if (wasSecret) basePower += 120
      break
  }

  // === ROLE BUFFS ===
  switch (zoneModifierId) {
    case "vanguard_ring":
      if (role === "vanguard") basePower += 150
      break
    case "fortress_gate":
      if (role === "guard") basePower += 150
      break
    case "speed_valley":
      if (role === "trickster") basePower += 150
      break
  }

  // === PROVISION / RARITY BUFFS ===
  switch (zoneModifierId) {
    case "heavy_weight":
      if (provision >= 10) basePower *= 2
      break
    case "trash_revolution":
      if ((card.rarity === "trash" || card.rarity === "common") && !isVandalism) basePower *= 4
      break
    case "golden_cage":
      if (["divine", "transcendent", "omnipotent"].includes(card.rarity) && !isVandalism) basePower *= 0.6
      break
    case "balanced_force":
      if (["epic", "super_rare", "rare"].includes(card.rarity) && !isVandalism) basePower += 100
      break
    case "black_market":
      if (["uncommon", "rare"].includes(card.rarity) && !isVandalism) basePower += 120
      break
    case "asceticism":
      if (provision <= 4) basePower += 150
      break
    case "power_vacuum":
      if (!hasIronCurtain) basePower *= 0.5
      break
    case "gambler_den":
      if (card.stats.luck >= 60) basePower += Math.floor(Math.random() * 201) + 50
      break
  }

  // === POSITION / COUNT SYNERGIES ===
  if (zoneModifierId === "duelist_honor" && myCards.length === 1 && enemyCards.length === 1) {
    basePower += 150
  }
  if (zoneModifierId === "lonely_hero" && myCards.length === 1 && enemyCards.length === 2) {
    basePower += 200
  }
  if (zoneModifierId === "tactical_synergy" && myCards.length === 2) {
    const roles = new Set(myCards.map(zc => zc.card.role || getCardRole(zc.card)))
    if (roles.size === 2) basePower += 100
  }
  if (zoneModifierId === "shared_fate" && enemyCards.length === 2) {
    const roles = new Set(enemyCards.map(zc => zc.card.role || getCardRole(zc.card)))
    if (roles.size === 1) basePower += 150
  }
  if (zoneModifierId === "unity" && myCards.length === 2) {
    const animes = new Set(myCards.map(zc => zc.card.anime))
    if (animes.size === 1) basePower += 150
  }
  if (zoneModifierId === "rivalry" && enemyCards.length === 2) {
    const animes = new Set(enemyCards.map(zc => zc.card.anime))
    if (animes.size === 2 && !hasIronCurtain) basePower -= 50
  }
  if (zoneModifierId === "double_bluff" && wasSecret) {
    const enemyHasSecret = enemyCards.some(zc => zc.wasSecret)
    if (enemyHasSecret) basePower += 200
  }

  // === KNB ROLE MATCHUPS ===
  let matchupBonusPercent = 0
  const reverseRPS = zoneModifierId === "reverse_rps"
  const noRPS = zoneModifierId === "no_rps"
  const doubleRPS = zoneModifierId === "double_rps"

  if (!noRPS && isRevealed && allEnemyCardsOnZone.length > 0) {
    allEnemyCardsOnZone.forEach(opposingZoneCard => {
      if (!opposingZoneCard.isSecret) {
        const opposingRole = opposingZoneCard.card.role || getCardRole(opposingZoneCard.card)
        let bonus = getKNBBonusMultiplier(role, opposingRole, reverseRPS)
        if (doubleRPS) bonus *= 2
        matchupBonusPercent += bonus
      }
    })
  }

  let finalPower = Math.round(basePower * (1 + matchupBonusPercent))

  // === FINAL MULTIPLIERS ===
  if (zoneModifierId === "god_domain" && card.rarity === "omnipotent" && !isVandalism) {
    finalPower = Math.round(finalPower * 2)
  }

  // === UNDERDOG (lowest provision on zone) ===
  if (zoneModifierId === "underdog_triumph") {
    const allOnZone = [...myCards, ...enemyCards]
    const provisions = allOnZone.map(zc => zc.card.provisionCost || getCardProvision(zc.card))
    const minProv = provisions.length > 0 ? Math.min(...provisions) : 0
    if (provision === minProv) finalPower += 250
  }

  return {
    power: finalPower,
    roleMatchupBonus: matchupBonusPercent
  }
}

