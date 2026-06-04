import { Dungeon, Enemy } from "./types"
import { calculateEnemyTeamPower } from "@/lib/battle-engine"

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
