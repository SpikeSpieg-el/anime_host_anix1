import { Dungeon, Enemy, Card, CardRole, ZoneCard, BattleZone, DeckContext, DeckSynergyResult } from "./types"
import { calculateEnemyTeamPower } from "@/lib/battle-engine"
import {
  RARITY_PROVISION_MAP, SYNERGY_VALUES, SYNERGY_DEFINITIONS, LIGHT_STEP_THRESHOLD, ELITE_RARITIES,
  SYNERGY_TOTAL_CAP, SYNERGY_TOTAL_FLOOR, LEADER_AURA_VALUE, FORMATION_CONFIG, FormationId,
} from "./config"

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
  return RARITY_PROVISION_MAP[card.rarity] !== undefined ? RARITY_PROVISION_MAP[card.rarity] : 0
}

export const getCardBasePower = (card: Card): number => {
  // Base power formula representing card's overall stat weight
  // Reduced multipliers to keep power in reasonable range (30-100 for early game)
  return Math.round((card.stats.hp / 8 + card.stats.atk * 0.5 + card.stats.def * 0.3 + card.stats.spd * 0.3 + card.stats.luck * 0.2))
}

// ==========================================
// DECK DEPTH: SYNERGIES, LEADER, FORMATION
// ==========================================

// Evaluate which passive synergies a deck composition unlocks.
// Returns role-agnostic global bonus + per-role adjustments (specialization).
export const computeDeckSynergies = (deck: Card[]): DeckSynergyResult => {
  const active: DeckSynergyResult["active"] = []
  let globalBonus = 0
  const roleAdjust = { vanguard: 0, guard: 0, trickster: 0 }

  if (!deck || deck.length === 0) {
    return { active, globalBonus, roleAdjust }
  }

  // Role counts
  const roleCounts: Record<CardRole, number> = { vanguard: 0, guard: 0, trickster: 0 }
  deck.forEach(c => { roleCounts[c.role || getCardRole(c)]++ })

  // Anime counts (brotherhood)
  const animeCounts: Record<string, number> = {}
  deck.forEach(c => { animeCounts[c.anime] = (animeCounts[c.anime] || 0) + 1 })
  const maxAnime = Math.max(0, ...Object.values(animeCounts))

  // 1. Brotherhood - proportional bonus per card
  if (maxAnime >= SYNERGY_VALUES.brotherhoodMinCards) {
    const brotherhoodBonus = SYNERGY_VALUES.brotherhoodPerCard * (maxAnime - 1)
    globalBonus += brotherhoodBonus
    active.push({ id: "brotherhood", ...SYNERGY_DEFINITIONS.brotherhood, value: brotherhoodBonus })
  }

  // 2. Role harmony (all 3 roles present)
  if (roleCounts.vanguard > 0 && roleCounts.guard > 0 && roleCounts.trickster > 0) {
    globalBonus += SYNERGY_VALUES.roleHarmony
    active.push({ id: "role_harmony", ...SYNERGY_DEFINITIONS.role_harmony, value: SYNERGY_VALUES.roleHarmony })
  }

  // 3. Rarity spectrum (5+ distinct rarities)
  const distinctRarities = new Set(deck.map(c => c.rarity)).size
  if (distinctRarities >= 5) {
    globalBonus += SYNERGY_VALUES.raritySpectrum
    active.push({ id: "rarity_spectrum", ...SYNERGY_DEFINITIONS.rarity_spectrum, value: SYNERGY_VALUES.raritySpectrum })
  }

  // 4. Light step (total provision weight <= threshold)
  const totalWeight = deck.reduce((acc, c) => acc + (c.provisionCost ?? getCardProvision(c)), 0)
  if (totalWeight <= LIGHT_STEP_THRESHOLD) {
    globalBonus += SYNERGY_VALUES.lightStep
    active.push({ id: "light_step", ...SYNERGY_DEFINITIONS.light_step, value: SYNERGY_VALUES.lightStep })
  }

  // 5. Elite (4+ epic or higher)
  const eliteCount = deck.filter(c => ELITE_RARITIES.includes(c.rarity)).length
  if (eliteCount >= 4) {
    globalBonus += SYNERGY_VALUES.elite
    active.push({ id: "elite", ...SYNERGY_DEFINITIONS.elite, value: SYNERGY_VALUES.elite })
  }

  // 6. Specialization (4+ of one role): bonus to that role, penalty to others
  ;(Object.keys(roleCounts) as CardRole[]).forEach(role => {
    if (roleCounts[role] >= 4) {
      roleAdjust[role] += SYNERGY_VALUES.specializationSelf
      ;(Object.keys(roleAdjust) as CardRole[]).forEach(other => {
        if (other !== role) roleAdjust[other] += SYNERGY_VALUES.specializationOther
      })
      active.push({
        id: "specialization", ...SYNERGY_DEFINITIONS.specialization,
        value: SYNERGY_VALUES.specializationSelf,
      })
    }
  })

  return { active, globalBonus, roleAdjust }
}

// Compute the final deck-wide power bonus for a single player card.
// Combines synergies + leader aura + formation, clamped to keep influence modest.
export const getDeckPowerModifier = (card: Card, ctx: DeckContext, wasSecret: boolean): number => {
  const { deck, leaderId, formation } = ctx
  const cardRole = card.role || getCardRole(card)

  const synergy = computeDeckSynergies(deck)
  let bonus = synergy.globalBonus + (synergy.roleAdjust[cardRole] || 0)

  // Leader aura (bonus only to cards of the same role as leader)
  if (leaderId) {
    const leader = deck.find(c => c.uniqueId === leaderId)
    if (leader) {
      const leaderRole = leader.role || getCardRole(leader)
      if (leaderRole === cardRole) {
        bonus += LEADER_AURA_VALUE
      }
    }
  }

  // Formation (role-specific bonus)
  if (formation && FORMATION_CONFIG[formation as FormationId]) {
    const formationConfig = FORMATION_CONFIG[formation as FormationId]
    bonus += formationConfig[cardRole] || 0
  }

  // Clamp total bonus
  bonus = Math.max(SYNERGY_TOTAL_FLOOR, Math.min(SYNERGY_TOTAL_CAP, bonus))

  return bonus
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
  isPlayerCard: boolean = true,
  placementOrder: number = 0,
  playerHpPercent: number = 100,
  deckContext?: DeckContext
): { power: number; roleMatchupBonus: number; synergyBonus: number } => {
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
    return { power: 150, roleMatchupBonus: 0, synergyBonus: 0 }
  }

  // === RARITY OVERRIDES ===
  if (zoneModifierId === "vandalism") {
    // All cards treated as common rarity for power calculation
    basePower = getCardBasePower({ ...card, rarity: "common" })
  }
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
      // Bonus only if secret card was placed second on the zone
      if (wasSecret && placementOrder === 1) basePower += 120
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

  // === RARITY BUFFS ===
  switch (zoneModifierId) {
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
  let secretRevealBonus = 0
  const reverseRPS = zoneModifierId === "reverse_rps"
  const noRPS = zoneModifierId === "no_rps"
  const doubleRPS = zoneModifierId === "double_rps"

  // Passive KNB bonus: always applies when facing revealed enemy cards
  if (!noRPS && allEnemyCardsOnZone.length > 0) {
    allEnemyCardsOnZone.forEach(opposingZoneCard => {
      if (!opposingZoneCard.isSecret) {
        const opposingRole = opposingZoneCard.card.role || getCardRole(opposingZoneCard.card)
        let bonus = getKNBBonusMultiplier(role, opposingRole, reverseRPS)
        if (doubleRPS) bonus *= 2
        matchupBonusPercent += bonus
      }
    })
  }

  // Secret reveal bonus: +15% of enemy power when secret card reveals and has KNB advantage
  if (wasSecret && isRevealed && matchupBonusPercent > 0 && allEnemyCardsOnZone.length > 0) {
    allEnemyCardsOnZone.forEach(opposingZoneCard => {
      if (!opposingZoneCard.isSecret) {
        const opposingRole = opposingZoneCard.card.role || getCardRole(opposingZoneCard.card)
        const hasAdvantage = getKNBBonusMultiplier(role, opposingRole, reverseRPS) > 0
        if (hasAdvantage) {
          const enemyPower = opposingZoneCard.powerAfterModifier || getCardBasePower(opposingZoneCard.card)
          secretRevealBonus += Math.round(enemyPower * 0.15)
        }
      }
    })
  }

  let finalPower = Math.round(basePower * (1 + matchupBonusPercent)) + secretRevealBonus

  // === FINAL MULTIPLIERS ===
  if (zoneModifierId === "god_domain" && card.rarity === "omnipotent" && !isVandalism) {
    finalPower = Math.round(finalPower * 2)
  }

  // === DECK-WIDE MODIFIERS (synergies, leader, formation) ===
  // Only apply to player cards (AI does not have deck depth)
  let synergyBonus = 0
  if (isPlayerCard && deckContext) {
    const deckBonus = getDeckPowerModifier(card, deckContext, wasSecret)
    synergyBonus = deckBonus
    finalPower = Math.round(finalPower + deckBonus)
  }

  return {
    power: finalPower,
    roleMatchupBonus: matchupBonusPercent,
    synergyBonus
  }
}

// Calculate only the territory modifier buff for display purposes
export const getTerritoryBuff = (
  card: Card,
  zoneModifierId: string,
  wasSecret: boolean = false,
  placementOrder: number = 0
): { value: number; description: string } => {
  const role = card.role || getCardRole(card)
  const provision = card.provisionCost || getCardProvision(card)
  const basePower = getCardBasePower(card)
  
  // Calculate power without territory modifier
  const powerWithoutTerritory = basePower
  
  // Calculate power with territory modifier
  const { power: powerWithTerritory } = calculateCardPowerOnZone(
    card,
    zoneModifierId,
    [],
    [],
    true,
    wasSecret,
    true,
    placementOrder
  )
  
  const buff = powerWithTerritory - powerWithoutTerritory
  
  // Get description based on modifier
  const descriptions: Record<string, string> = {
    shadow_step: wasSecret ? "+100 (скрытая)" : "0",
    mirage_zone: wasSecret ? "x2 (скрытая)" : "-50%",
    first_strike: "+80 (открытая)",
    ambush_point: placementOrder === 1 ? "+120 (скрытая 2-я)" : "0",
    vanguard_ring: role === "vanguard" ? "+150" : "0",
    fortress_gate: role === "guard" ? "+150" : "0",
    speed_valley: role === "trickster" ? "+150" : "0",
    trash_revolution: (card.rarity === "trash" || card.rarity === "common") ? "x4" : "0",
    golden_cage: ["divine", "transcendent", "omnipotent"].includes(card.rarity) ? "-40%" : "0",
    balanced_force: ["epic", "super_rare", "rare"].includes(card.rarity) ? "+100" : "0",
    black_market: ["uncommon", "rare"].includes(card.rarity) ? "+120" : "0",
    power_vacuum: "-50%",
    god_domain: card.rarity === "omnipotent" ? "x2" : "0",
    lonely_hero: "+200 (один против двух)",
    duelist_honor: "+150 (дуэль)",
    tactical_synergy: "+100 (разные роли)",
    shared_fate: "+150 (одинаковые роли врага)",
    unity: "+150 (одно аниме)",
    rivalry: "-50 (разные аниме врага)",
    double_bluff: wasSecret ? "+200 (двойной блеф)" : "0",
    equality: "фиксировано 150",
    gambler_den: card.stats.luck >= 60 ? "рандом 50-250" : "0",
  }
  
  return {
    value: buff,
    description: descriptions[zoneModifierId] || "0"
  }
}
